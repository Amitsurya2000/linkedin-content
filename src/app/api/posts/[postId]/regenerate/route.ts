import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches, userApiKeys, creatorProfiles } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateCarousels } from "@/lib/carousel-prompt";
import { generateContentAgentPosts } from "@/lib/content-agent";
import { recentAngles, recentChoices } from "@/lib/history";
import { profileToContext, type CreatorProfileData } from "@/lib/resume";

export const maxDuration = 300;

/**
 * POST — rewrite this post from scratch.
 *
 * The render routes redraw what is already stored; they cannot change a topic,
 * a headline or a palette, because all three were fixed when the post was first
 * generated. That is why a re-render used to come back looking identical no
 * matter how the seed or the temperature moved: nothing was being regenerated.
 *
 * This route is the missing step. It re-runs the generator for the post, draws
 * a fresh topic / angle / hook / theme excluding what the last renders used,
 * and overwrites the stored copy. The render call that follows then has genuinely
 * new material to draw.
 *
 * The previous images are dropped here too — they belong to copy that no longer
 * exists, and leaving them would show the old deck beside the new words.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const { postId } = await params;

    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, userId)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const [batch] = await db
      .select({ topic: postBatches.topic, targetAudience: postBatches.targetAudience, tonePrefs: postBatches.tonePrefs })
      .from(postBatches)
      .where(eq(postBatches.id, post.batchId))
      .limit(1);

    const [keyRow] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini")))
      .limit(1);
    if (!keyRow) {
      return NextResponse.json(
        { error: "No Gemini API key found. Please add your API key in Settings." },
        { status: 400 }
      );
    }
    const apiKey = decrypt(keyRow.encryptedKey, keyRow.iv, keyRow.authTag);

    let profileContext: string | undefined;
    const [profileRow] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);
    if (profileRow?.profileJson) {
      try {
        profileContext = profileToContext(JSON.parse(profileRow.profileJson) as CreatorProfileData);
      } catch {
        profileContext = undefined;
      }
    }

    const topic = batch?.topic || post.hook || "";
    const isCarousel = post.postType === "carousel";

    const [fresh] = isCarousel
      ? await generateCarousels({
          apiKey,
          topic,
          postsCount: 1,
          profileContext,
          targetAudience: batch?.targetAudience || undefined,
          tonePrefs: batch?.tonePrefs || undefined,
          // Scoped to the user, not the topic: a re-render keeps its topic by
          // definition, so filtering by it would hand back the very deck this
          // render is trying to differ from.
          history: await recentChoices(userId),
          nonceFor: () => 1000 + Math.floor(Math.random() * 998999),
        })
      : await generateContentAgentPosts({
          apiKey,
          topic,
          postsCount: 1,
          profileContext,
          targetAudience: batch?.targetAudience || undefined,
          tonePrefs: batch?.tonePrefs || undefined,
          previousAngles: await recentAngles(userId),
        });

    if (!fresh) {
      return NextResponse.json({ error: "The model returned nothing to save." }, { status: 502 });
    }

    await db
      .update(generatedPosts)
      .set({
        hookCategory: fresh.hookCategory || post.hookCategory,
        hook: fresh.hook || "",
        body: fresh.body || "",
        hashtags: JSON.stringify(fresh.hashtags ?? []),
        cta: fresh.cta || "",
        whyThisWorks: fresh.whyThisWorks || "",
        variations: JSON.stringify(fresh.variations ?? []),
        carouselSlides: fresh.carouselSlides ? JSON.stringify(fresh.carouselSlides) : null,
        visualDirective:
          "visualDirective" in fresh && fresh.visualDirective
            ? JSON.stringify(fresh.visualDirective)
            : null,
        // Clear the pipeline: these pictures illustrate copy that is now gone.
        imageUrl: null,
        carouselImages: null,
      })
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({
      id: postId,
      hookCategory: fresh.hookCategory,
      hook: fresh.hook,
      body: fresh.body,
      hashtags: fresh.hashtags,
      cta: fresh.cta,
      whyThisWorks: fresh.whyThisWorks,
      carouselSlides: fresh.carouselSlides ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed";
    console.error("Regeneration error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
