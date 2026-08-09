import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts } from "@/lib/db/schema";

const updateSchema = z.object({
  captionHook: z.string().optional(),
  captionBody: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  hookCategory: z.string().optional(),
  whyThisWorks: z.string().optional(),
  approvalStatus: z.enum(["draft", "approved", "scheduled", "published", "rejected"]).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

/** PATCH — Update caption fields on a generated post */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { postId } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { scheduledAt: scheduledAtStr, ...textUpdates } = parsed.data;
    const updates: Record<string, unknown> = { ...textUpdates };
    if (scheduledAtStr !== undefined) {
      updates.scheduledAt = scheduledAtStr ? new Date(scheduledAtStr) : null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Verify ownership
    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(
        and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id))
      )
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await db
      .update(generatedPosts)
      .set(updates)
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({ success: true, ...updates });
  } catch (err) {
    console.error("Update post error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
