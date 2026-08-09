import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts } from "@/lib/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { batchId } = await params;
    const userId = session.user.id;

    // Verify batch belongs to user
    const [batch] = await db
      .select()
      .from(postBatches)
      .where(and(eq(postBatches.id, batchId), eq(postBatches.userId, userId)))
      .limit(1);

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Read current post states from DB (images route updates them as they complete)
    const posts = await db
      .select()
      .from(generatedPosts)
      .where(eq(generatedPosts.batchId, batchId));

    const allDone = posts.every(
      (p) => p.status === "completed" || p.status === "failed"
    );

    return NextResponse.json({
      batchId,
      status: allDone ? "completed" : batch.status,
      posts: posts.map((p) => ({
        id: p.id,
        status: p.status,
        imageUrl: p.imageUrl,
        hookCategory: p.hookCategory,
        captionHook: p.captionHook,
        designBrief: p.designBrief,
        whyThisWorks: p.whyThisWorks,
      })),
    });
  } catch (err) {
    console.error("Batch status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
