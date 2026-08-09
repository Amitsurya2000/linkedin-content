import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches, socialAccounts } from "@/lib/db/schema";
import { getUserApiKey } from "@/lib/crypto";
import { publishPost } from "@/lib/getlate";

const schema = z.object({
  postId: z.string().uuid(),
  accountId: z.string().optional(), // optional — auto-resolved from workspace if omitted
});

/** POST — Publish a generated post to Instagram via GetLate */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { postId } = parsed.data;
  let { accountId } = parsed.data;
  const userId = session.user.id;

  // Fetch the post
  const [post] = await db
    .select()
    .from(generatedPosts)
    .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, userId)))
    .limit(1);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!post.imageUrl) {
    return NextResponse.json({ error: "Post has no image" }, { status: 400 });
  }

  // Auto-resolve accountId from workspace if not provided
  if (!accountId) {
    const [batch] = await db
      .select({ workspaceId: postBatches.workspaceId })
      .from(postBatches)
      .where(eq(postBatches.id, post.batchId))
      .limit(1);

    if (batch?.workspaceId) {
      const [linked] = await db
        .select({ accountId: socialAccounts.accountId })
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.userId, userId),
            eq(socialAccounts.workspaceId, batch.workspaceId)
          )
        )
        .limit(1);
      accountId = linked?.accountId;
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "No Instagram account linked to this workspace. Link one in Workspace Settings." },
        { status: 400 }
      );
    }
  }

  // Get user's GetLate API key
  const apiKey = await getUserApiKey(userId, "getlate");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Please add your GetLate API key in Settings" },
      { status: 400 }
    );
  }

  try {
    // Build full caption: hook + body + hashtags
    const captionParts = [post.captionHook || ""];
    if (post.captionBody) captionParts.push(post.captionBody);
    const hashtags = post.hashtags as string[] | null;
    if (hashtags?.length) captionParts.push(hashtags.join(" "));
    const fullCaption = captionParts.join("\n\n");

    const result = await publishPost(apiKey, {
      content: fullCaption,
      imageUrl: post.imageUrl,
      accountId,
    });

    // Update post record
    await db
      .update(generatedPosts)
      .set({
        publishedAt: new Date(),
        instagramPostId: result.id,
        approvalStatus: "published",
      })
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({ success: true, postId: result.id });
  } catch (err) {
    console.error("Publish error:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to publish: ${errMsg}` },
      { status: 500 }
    );
  }
}
