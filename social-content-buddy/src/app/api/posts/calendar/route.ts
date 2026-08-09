import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, or, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches } from "@/lib/db/schema";

/** GET /api/posts/calendar?start=2026-03-01&end=2026-03-31&workspace=uuid
 *  Returns all user posts that are scheduled, published, or completed within the date range.
 *  Optional workspace filter.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const workspaceId = searchParams.get("workspace");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const startDate = new Date(start + "T00:00:00.000Z");
  const endDate = new Date(end + "T23:59:59.999Z");

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const conditions = [
      eq(generatedPosts.userId, session.user.id),
      eq(generatedPosts.status, "completed"),
      or(
        and(
          isNotNull(generatedPosts.scheduledAt),
          gte(generatedPosts.scheduledAt, startDate),
          lte(generatedPosts.scheduledAt, endDate)
        ),
        and(
          isNotNull(generatedPosts.publishedAt),
          gte(generatedPosts.publishedAt, startDate),
          lte(generatedPosts.publishedAt, endDate)
        )
      ),
    ];

    let posts;
    if (workspaceId) {
      // Join through post_batches to filter by workspace
      posts = await db
        .select({
          id: generatedPosts.id,
          batchId: generatedPosts.batchId,
          userId: generatedPosts.userId,
          hookCategory: generatedPosts.hookCategory,
          captionHook: generatedPosts.captionHook,
          captionBody: generatedPosts.captionBody,
          hashtags: generatedPosts.hashtags,
          designBrief: generatedPosts.designBrief,
          whyThisWorks: generatedPosts.whyThisWorks,
          captionVariations: generatedPosts.captionVariations,
          imageUrl: generatedPosts.imageUrl,
          status: generatedPosts.status,
          scheduledAt: generatedPosts.scheduledAt,
          publishedAt: generatedPosts.publishedAt,
          approvalStatus: generatedPosts.approvalStatus,
          createdAt: generatedPosts.createdAt,
        })
        .from(generatedPosts)
        .innerJoin(postBatches, eq(generatedPosts.batchId, postBatches.id))
        .where(and(...conditions, eq(postBatches.workspaceId, workspaceId)));
    } else {
      posts = await db
        .select()
        .from(generatedPosts)
        .where(and(...conditions));
    }

    return NextResponse.json(posts);
  } catch (err) {
    console.error("Calendar error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
