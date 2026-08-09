import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts } from "@/lib/db/schema";

/** GET — Return a single post by id (verify ownership) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { postId } = await params;

    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(
        and(
          eq(generatedPosts.id, postId),
          eq(generatedPosts.userId, session.user.id)
        )
      )
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Parse JSON fields for the response
    return NextResponse.json({
      ...post,
      hashtags: safeJsonParse(post.hashtags, []),
      variations: safeJsonParse(post.variations, []),
      carouselSlides: post.carouselSlides
        ? safeJsonParse(post.carouselSlides, null)
        : null,
    });
  } catch (err) {
    console.error("Get post error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** PATCH — Update post fields (verify ownership) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { postId } = await params;
    const body = await req.json();

    // Verify ownership
    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(
        and(
          eq(generatedPosts.id, postId),
          eq(generatedPosts.userId, session.user.id)
        )
      )
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Build updates object — only include provided fields
    const updates: Record<string, unknown> = {};

    if (body.hook !== undefined) updates.hook = body.hook;
    if (body.body !== undefined) updates.body = body.body;
    if (body.hookCategory !== undefined) updates.hookCategory = body.hookCategory;
    if (body.cta !== undefined) updates.cta = body.cta;
    if (body.whyThisWorks !== undefined) updates.whyThisWorks = body.whyThisWorks;

    if (body.hashtags !== undefined) {
      updates.hashtags = JSON.stringify(body.hashtags);
    }

    if (body.approvalStatus !== undefined) {
      const validStatuses = ["draft", "approved", "scheduled", "published"];
      if (!validStatuses.includes(body.approvalStatus)) {
        return NextResponse.json(
          { error: "Invalid approvalStatus" },
          { status: 400 }
        );
      }
      updates.approvalStatus = body.approvalStatus;
    }

    if (body.scheduledAt !== undefined) {
      updates.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }

    if (body.publishedAt !== undefined) {
      updates.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(generatedPosts)
      .set(updates)
      .where(eq(generatedPosts.id, postId))
      .returning();

    return NextResponse.json({
      ...updated,
      hashtags: safeJsonParse(updated.hashtags, []),
      variations: safeJsonParse(updated.variations, []),
      carouselSlides: updated.carouselSlides
        ? safeJsonParse(updated.carouselSlides, null)
        : null,
    });
  } catch (err) {
    console.error("Update post error:", err);
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
