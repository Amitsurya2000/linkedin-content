import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creatorProfiles, generatedPosts, postBatches, users, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateContentAgentPosts } from "@/lib/content-agent";
import { profileToContext, type CreatorProfileData } from "@/lib/resume";
import { composePost } from "@/lib/utils";
import { context, divider, isSlackConfigured, respond, section, verifySlackRequest } from "@/lib/slack";

export const maxDuration = 300;

/**
 * POST /api/slack/command — the `/post <topic>` slash command.
 *
 * Slack gives a command three seconds to reply. Generation takes 30 to 90, so
 * this acks immediately with a placeholder and posts the finished result to
 * `response_url` afterwards. Doing the work first would make Slack show
 * "operation_timeout" every time, whatever the server eventually returned.
 *
 * The other difference from /api/generate is the user. That route reads the
 * session; a Slack request has none, and never will — Slack's servers make the
 * call, not a browser. The account is resolved from SLACK_POST_AS_EMAIL, which
 * also means a Slack workspace cannot reach any account but the one named there.
 */

const DEFAULT_COUNT = 1;

export async function POST(req: NextRequest) {
  // The raw body is needed for the signature, so it is read once as text and
  // parsed afterwards. Calling req.formData() first would consume the stream.
  const raw = await req.text();

  const check = verifySlackRequest(
    raw,
    req.headers.get("x-slack-signature"),
    req.headers.get("x-slack-request-timestamp")
  );
  if (!check.ok) {
    // 401 rather than a friendly message: an unverified caller is not a user.
    console.error("Slack verification failed:", check.reason);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const form = new URLSearchParams(raw);
  const topic = (form.get("text") || "").trim();
  const responseUrl = form.get("response_url") || "";
  const slackUser = form.get("user_name") || "someone";

  if (!topic) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Give me a topic — `/post how I cut our query time from 850ms to 120ms`",
    });
  }

  // Fire and forget: the ack below must not wait for this.
  void generate(topic, responseUrl, slackUser);

  return NextResponse.json({
    response_type: "in_channel",
    text: `Writing a post about *${topic}* — about a minute.`,
  });
}

/** Everything after the ack. Nothing here can throw into the HTTP response. */
async function generate(topic: string, responseUrl: string, slackUser: string): Promise<void> {
  try {
    const email = process.env.SLACK_POST_AS_EMAIL || "";
    if (!email) {
      await respond(responseUrl, { text: "SLACK_POST_AS_EMAIL is not set on the server." });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      await respond(responseUrl, { text: `No account found for ${email}.` });
      return;
    }

    const [keyRow] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, user.id), eq(userApiKeys.provider, "gemini")))
      .limit(1);
    if (!keyRow) {
      await respond(responseUrl, { text: "No Gemini key on that account — add one in Settings." });
      return;
    }

    // The creator profile is what makes the post specific rather than generic,
    // so it is loaded here exactly as the web route loads it.
    let profileContext: string | undefined;
    const [profileRow] = await db
      .select({ profileJson: creatorProfiles.profileJson })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, user.id))
      .limit(1);
    if (profileRow?.profileJson) {
      try {
        profileContext = profileToContext(JSON.parse(profileRow.profileJson) as CreatorProfileData);
      } catch {
        profileContext = undefined;
      }
    }

    const [batch] = await db
      .insert(postBatches)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        topic,
        postType: "text",
        postsCount: DEFAULT_COUNT,
        status: "generating_briefs",
      })
      .returning();

    // Same prompt the web route uses for text posts — see
    // src/lib/prompts/linkedin-content-agent.md.
    const posts = await generateContentAgentPosts({
      apiKey: decrypt(keyRow.encryptedKey, keyRow.iv, keyRow.authTag),
      topic,
      postsCount: DEFAULT_COUNT,
      profileContext,
    });

    // Stored so the post appears in History alongside anything made in the app,
    // rather than existing only in a Slack message.
    for (const p of posts) {
      await db.insert(generatedPosts).values({
        id: crypto.randomUUID(),
        batchId: batch.id,
        userId: user.id,
        postType: "text",
        hookCategory: p.hookCategory ?? "",
        hook: p.hook ?? "",
        body: p.body ?? "",
        hashtags: JSON.stringify(p.hashtags ?? []),
        cta: p.cta ?? "",
        whyThisWorks: p.whyThisWorks ?? "",
        variations: JSON.stringify(p.variations ?? []),
        // The visual brief written alongside the copy, so a post asked for in
        // Slack can still be illustrated later from the app.
        visualDirective: p.visualDirective ? JSON.stringify(p.visualDirective) : null,
        status: "draft",
        approvalStatus: "draft",
      });
    }
    await db.update(postBatches).set({ status: "completed" }).where(eq(postBatches.id, batch.id));

    const post = posts[0];
    // composePost, not a hand-rolled join: the model routinely repeats the hook
    // and the hashtags inside body, and joining the three fields blindly is what
    // put them in the clipboard twice everywhere else.
    const full = composePost(post.hook ?? "", post.body ?? "", post.hashtags ?? []);

    await respond(responseUrl, {
      text: post.hook ?? topic,
      blocks: [
        section(`*${post.hook ?? topic}*`),
        divider,
        section(full),
        context(
          `_${post.hookCategory ?? "post"}_  ·  asked by @${slackUser}  ·  saved to History as \`${batch.id.slice(0, 8)}\``
        ),
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Slack generation failed:", err);
    await respond(responseUrl, {
      response_type: "ephemeral",
      text: `Could not write that post: ${message.slice(0, 300)}`,
    });
  }
}

/** GET is only ever a human checking the URL is live. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: isSlackConfigured(),
    hint: "POST here from a Slack slash command.",
  });
}
