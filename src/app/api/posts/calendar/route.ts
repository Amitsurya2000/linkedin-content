import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, isNotNull, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches } from "@/lib/db/schema";

/** GET /api/posts/calendar?start=timestamp&end=timestamp
 *  Returns all user posts that have scheduledAt between start and end.
 *  Includes batch info for each post. Ordered by scheduledAt ASC.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "start and end query params are required (timestamps)" },
      { status: 400 }
    );
  }

  const startTs = Number(startParam);
  const endTs = Number(endParam);

  if (isNaN(startTs) || isNaN(endTs)) {
    return NextResponse.json(
      { error: "start and end must be valid timestamps" },
      { status: 400 }
    );
  }

  const startDate = new Date(startTs);
  const endDate = new Date(endTs);

  try {
    const posts = await db
      .select({
        id: generatedPosts.id,
        batchId: generatedPosts.batchId,
        userId: generatedPosts.userId,
        postType: generatedPosts.postType,
        hookCategory: generatedPosts.hookCategory,
        hook: generatedPosts.hook,
        body: generatedPosts.body,
        hashtags: generatedPosts.hashtags,
        cta: generatedPosts.cta,
        whyThisWorks: generatedPosts.whyThisWorks,
        variations: generatedPosts.variations,
        carouselSlides: generatedPosts.carouselSlides,
        imageUrl: generatedPosts.imageUrl,
        status: generatedPosts.status,
        scheduledAt: generatedPosts.scheduledAt,
        publishedAt: generatedPosts.publishedAt,
        approvalStatus: generatedPosts.approvalStatus,
        createdAt: generatedPosts.createdAt,
        // Batch info
        batchTopic: postBatches.topic,
        batchIndustry: postBatches.industry,
        batchTargetAudience: postBatches.targetAudience,
      })
      .from(generatedPosts)
      .innerJoin(postBatches, eq(generatedPosts.batchId, postBatches.id))
      .where(
        and(
          eq(generatedPosts.userId, session.user.id),
          isNotNull(generatedPosts.scheduledAt),
          gte(generatedPosts.scheduledAt, startDate),
          lte(generatedPosts.scheduledAt, endDate)
        )
      )
      .orderBy(asc(generatedPosts.scheduledAt));

    // Parse JSON fields in the response
    const parsedPosts = posts.map((post) => ({
      ...post,
      hashtags: safeJsonParse(post.hashtags, []),
      variations: safeJsonParse(post.variations, []),
      carouselSlides: post.carouselSlides
        ? safeJsonParse(post.carouselSlides, null)
        : null,
    }));

    return NextResponse.json(parsedPosts);
  } catch (err) {
    console.error("Calendar error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
