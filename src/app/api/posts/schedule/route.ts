import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts } from "@/lib/db/schema";

/** POST /api/posts/schedule  { postId, scheduledAt (ISO string) }
 *  Marks a post as scheduled for a given date/time. It then appears on the
 *  Calendar. This does NOT auto-publish to LinkedIn — connecting a LinkedIn /
 *  GetLate account (Settings) is required for true auto-posting; until then a
 *  scheduled post is a reminder + one-click "copy & open LinkedIn".
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { postId, scheduledAt } = await req.json();
    if (!postId || !scheduledAt) {
      return NextResponse.json(
        { error: "postId and scheduledAt are required" },
        { status: 400 }
      );
    }

    const when = new Date(scheduledAt);
    if (isNaN(when.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt date" }, { status: 400 });
    }

    const [post] = await db
      .select({ id: generatedPosts.id })
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const [updated] = await db
      .update(generatedPosts)
      .set({ scheduledAt: when, approvalStatus: "scheduled", publishedAt: null })
      .where(eq(generatedPosts.id, postId))
      .returning();

    return NextResponse.json({
      ok: true,
      scheduledAt: when.toISOString(),
      approvalStatus: updated.approvalStatus,
    });
  } catch (err) {
    console.error("Schedule error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
