import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts } from "@/lib/db/schema";

/** POST /api/posts/publish  { postId }
 *  Marks a post as published now. LinkedIn has no open "post on my behalf" API
 *  without an approved app / a connected GetLate account, so this records the
 *  post as published and stamps the time; the client opens LinkedIn's composer
 *  with the copy on the clipboard so the user can paste + post in one click.
 *  When a LinkedIn/GetLate key is later added in Settings, this is the single
 *  place to fire the real publish call.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const [post] = await db
      .select({ id: generatedPosts.id, scheduledAt: generatedPosts.scheduledAt })
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const now = new Date();
    const [updated] = await db
      .update(generatedPosts)
      .set({
        approvalStatus: "published",
        publishedAt: now,
        // Ensure it lands on the calendar (on today) even if it was never scheduled.
        scheduledAt: post.scheduledAt ?? now,
      })
      .where(eq(generatedPosts.id, postId))
      .returning();

    return NextResponse.json({
      ok: true,
      publishedAt: now.toISOString(),
      approvalStatus: updated.approvalStatus,
    });
  } catch (err) {
    console.error("Publish error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
