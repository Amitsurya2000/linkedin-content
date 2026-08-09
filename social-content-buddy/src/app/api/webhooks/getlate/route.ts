import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { generatedPosts } from "@/lib/db/schema";

const WEBHOOK_SECRET = process.env.GETLATE_WEBHOOK_SECRET;

function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
}

/**
 * POST — Webhook receiver for GetLate/Zernio post status updates.
 * Called by GetLate when a scheduled post is published or fails.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify HMAC signature if a secret is configured
  if (WEBHOOK_SECRET) {
    const signature = req.headers.get("x-late-signature");
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const postId = (body.postId ?? body.post_id ?? (body.data as Record<string, unknown>)?.postId ?? (body.data as Record<string, unknown>)?._id) as string | undefined;

  if (!event || !postId) {
    return NextResponse.json({ error: "Missing event or postId" }, { status: 400 });
  }

  if (event === "post.published") {
    await db
      .update(generatedPosts)
      .set({
        approvalStatus: "published",
        publishedAt: new Date(),
      })
      .where(eq(generatedPosts.instagramPostId, postId));
  } else if (event === "post.failed") {
    await db
      .update(generatedPosts)
      .set({
        approvalStatus: "failed",
      })
      .where(eq(generatedPosts.instagramPostId, postId));
  }

  return NextResponse.json({ ok: true });
}
