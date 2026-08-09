import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts, userApiKeys, creatorProfiles } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateLinkedInPosts } from "@/lib/gemini";
import { profileToContext, type CreatorProfileData } from "@/lib/resume";
import { eq, and } from "drizzle-orm";

const VALID_POST_TYPES = ["text", "carousel", "article", "poll"] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { topic, postType, postsCount, industry, targetAudience, tonePrefs } = body;

    // Validate required fields
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    if (!VALID_POST_TYPES.includes(postType)) {
      return NextResponse.json(
        { error: "postType must be one of: text, carousel, article, poll" },
        { status: 400 }
      );
    }

    const count = Number(postsCount);
    if (!count || count < 1 || count > 10) {
      return NextResponse.json(
        { error: "postsCount must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Get user's Gemini API key
    const [geminiKeyRow] = await db
      .select()
      .from(userApiKeys)
      .where(
        and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini"))
      )
      .limit(1);

    if (!geminiKeyRow) {
      return NextResponse.json(
        { error: "No Gemini API key found. Please add your API key in Settings." },
        { status: 400 }
      );
    }

    const apiKey = decrypt(geminiKeyRow.encryptedKey, geminiKeyRow.iv, geminiKeyRow.authTag);

    // Load the client's resume-derived Creator Profile (base context for content)
    let profileContext: string | undefined;
    const [profileRow] = await db
      .select({ profileJson: creatorProfiles.profileJson })
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

    // Create batch record
    const [batch] = await db
      .insert(postBatches)
      .values({
        id: crypto.randomUUID(),
        userId,
        topic: topic.trim(),
        industry: industry || null,
        targetAudience: targetAudience || null,
        tonePrefs: tonePrefs || null,
        postType,
        postsCount: count,
        status: "generating_briefs",
      })
      .returning();

    try {
      // Generate posts via Gemini
      const linkedInPosts = await generateLinkedInPosts({
        apiKey,
        topic: topic.trim(),
        postType,
        postsCount: count,
        industry: industry || undefined,
        targetAudience: targetAudience || undefined,
        tonePrefs: tonePrefs || undefined,
        profileContext,
      });

      // Create generated post records — defensively default every field, since
      // the model can omit fields (e.g. variations) and NOT NULL columns would
      // otherwise reject the insert.
      const createdPosts = [];
      for (const post of linkedInPosts) {
        const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
        const variations = Array.isArray(post.variations) ? post.variations : [];
        const [created] = await db
          .insert(generatedPosts)
          .values({
            id: crypto.randomUUID(),
            batchId: batch.id,
            userId,
            postType,
            hookCategory: post.hookCategory || "Insight",
            hook: post.hook || "",
            body: post.body || "",
            hashtags: JSON.stringify(hashtags),
            cta: post.cta || "",
            whyThisWorks: post.whyThisWorks || "",
            variations: JSON.stringify(variations),
            carouselSlides: post.carouselSlides
              ? JSON.stringify(post.carouselSlides)
              : null,
            status: "completed",
            approvalStatus: "draft",
          })
          .returning();

        createdPosts.push({
          ...created,
          hashtags,
          variations,
          carouselSlides: post.carouselSlides || null,
        });
      }

      // Update batch to completed
      await db
        .update(postBatches)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(postBatches.id, batch.id));

      return NextResponse.json({
        batchId: batch.id,
        posts: createdPosts,
      });
    } catch (genError) {
      // Update batch to failed
      const errorMessage =
        genError instanceof Error ? genError.message : "Unknown generation error";

      await db
        .update(postBatches)
        .set({
          status: "failed",
          errorMessage,
        })
        .where(eq(postBatches.id, batch.id));

      console.error("Post generation error:", genError);
      return NextResponse.json(
        { error: "Failed to generate posts", details: errorMessage },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Generate route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
