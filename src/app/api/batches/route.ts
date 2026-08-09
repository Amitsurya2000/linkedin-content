import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, inArray, lt, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts } from "@/lib/db/schema";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Auto-recover stuck batches: if a batch has been "generating" for >10 min, mark it failed
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    await db
      .update(postBatches)
      .set({ status: "failed", errorMessage: "Generation timed out" })
      .where(
        and(
          eq(postBatches.userId, userId),
          inArray(postBatches.status, [
            "generating_briefs",
            "generating_images",
          ]),
          lt(postBatches.createdAt, staleThreshold)
        )
      );

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "10", 10), 1),
      100
    );

    // Get batches with post counts
    const batches = await db
      .select({
        id: postBatches.id,
        userId: postBatches.userId,
        topic: postBatches.topic,
        industry: postBatches.industry,
        targetAudience: postBatches.targetAudience,
        tonePrefs: postBatches.tonePrefs,
        postType: postBatches.postType,
        postsCount: postBatches.postsCount,
        status: postBatches.status,
        designBriefs: postBatches.designBriefs,
        errorMessage: postBatches.errorMessage,
        createdAt: postBatches.createdAt,
        completedAt: postBatches.completedAt,
        postCount: sql<number>`(
          SELECT COUNT(*) FROM generated_posts
          WHERE generated_posts.batch_id = ${postBatches.id}
        )`.as("post_count"),
      })
      .from(postBatches)
      .where(eq(postBatches.userId, userId))
      .orderBy(desc(postBatches.createdAt))
      .limit(limit);

    return NextResponse.json(batches);
  } catch (err) {
    console.error("Batches GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
