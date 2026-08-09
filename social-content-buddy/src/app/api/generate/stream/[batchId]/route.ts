import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts } from "@/lib/db/schema";
import { generateImage } from "@/lib/fal";
import { uploadImageFromUrl, postImageKey } from "@/lib/storage";
import { getUserApiKey } from "@/lib/crypto";

export const maxDuration = 300;

// Track in-progress generation jobs so we don't double-trigger
const activeJobs = new Set<string>();

/**
 * Run image generation for a batch. This runs as a detached promise —
 * it continues even if the HTTP request/SSE stream is cancelled.
 */
async function runImageGeneration(
  batchId: string,
  posts: { id: string; designBrief: string | null }[],
  falKey: string,
  imageUrls?: string[]
) {
  if (activeJobs.has(batchId)) return;
  activeJobs.add(batchId);

  try {
    // Mark all posts as generating
    await db
      .update(generatedPosts)
      .set({ status: "generating" })
      .where(eq(generatedPosts.batchId, batchId));

    // Generate all images in parallel
    const results = await Promise.allSettled(
      posts.map(async (post) => {
        try {
          const falUrl = await generateImage(
            {
              prompt: post.designBrief ?? "",
              quality: "medium",
              imageSize: "1024x1024",
              imageUrls: imageUrls?.length ? imageUrls : undefined,
            },
            falKey
          );

          const key = postImageKey(batchId, post.id);
          let finalUrl: string;
          try {
            finalUrl = await uploadImageFromUrl(falUrl, key);
          } catch {
            finalUrl = falUrl; // R2 not configured — use fal.ai CDN URL
          }

          await db
            .update(generatedPosts)
            .set({ status: "completed", imageUrl: finalUrl })
            .where(eq(generatedPosts.id, post.id));
        } catch (err) {
          await db
            .update(generatedPosts)
            .set({ status: "failed" })
            .where(eq(generatedPosts.id, post.id));
          throw err;
        }
      })
    );

    // Mark batch complete
    await db
      .update(postBatches)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(postBatches.id, batchId));

    return {
      completed: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  } catch (err) {
    // Mark batch as failed so it doesn't stay stuck in "generating" forever
    await db
      .update(postBatches)
      .set({ status: "failed", errorMessage: String(err) })
      .where(eq(postBatches.id, batchId));
    throw err;
  } finally {
    activeJobs.delete(batchId);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { batchId } = await params;
  const userId = session.user.id;

  const [batch] = await db
    .select()
    .from(postBatches)
    .where(and(eq(postBatches.id, batchId), eq(postBatches.userId, userId)))
    .limit(1);

  if (!batch) {
    return new Response("Batch not found", { status: 404 });
  }

  const posts = await db
    .select()
    .from(generatedPosts)
    .where(eq(generatedPosts.batchId, batchId));

  const encoder = new TextEncoder();

  // Fetch user's fal.ai API key
  const falKey = await getUserApiKey(userId, "fal");
  if (!falKey) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Please add your fal.ai API key in Settings" })}\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      }
    );
  }

  // Check if any posts still need generation
  const needsGeneration = posts.some(
    (p) => p.status === "pending" || p.status === "generating"
  );

  if (needsGeneration && !activeJobs.has(batchId)) {
    // Build reference image URLs from batch (logo + product)
    const refImageUrls: string[] = [];
    if (batch.logoUrl) refImageUrls.push(batch.logoUrl);
    if (batch.productImageUrl) refImageUrls.push(batch.productImageUrl);

    // Fire-and-forget: start generation OUTSIDE the stream lifecycle.
    // This detached promise continues even if the client disconnects.
    runImageGeneration(batchId, posts, falKey, refImageUrls.length ? refImageUrls : undefined).catch((err) => {
      console.error(`Background generation failed for batch ${batchId}:`, err);
    });
  }

  // SSE stream: poll DB and stream progress to the client
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // client disconnected
        }
      };

      // Track which posts we've already reported as completed/failed
      const reported = new Set<string>();
      for (const p of posts) {
        if (p.status === "completed" || p.status === "failed") {
          reported.add(p.id);
        }
      }

      try {
        // Poll DB every 2 seconds until all posts are done
        const maxPolls = 150; // 5 minutes max (150 * 2s)
        for (let i = 0; i < maxPolls; i++) {
          const currentPosts = await db
            .select()
            .from(generatedPosts)
            .where(eq(generatedPosts.batchId, batchId));

          // Stream events for newly completed/failed posts
          for (const p of currentPosts) {
            if (reported.has(p.id)) continue;

            if (p.status === "completed") {
              reported.add(p.id);
              send({
                type: "post_completed",
                post: {
                  id: p.id,
                  imageUrl: p.imageUrl,
                  hookCategory: p.hookCategory,
                  captionHook: p.captionHook,
                  designBrief: p.designBrief,
                  whyThisWorks: p.whyThisWorks,
                },
              });
            } else if (p.status === "failed") {
              reported.add(p.id);
              send({ type: "post_failed", postId: p.id });
            }
          }

          // Check if all done
          const allDone = currentPosts.every(
            (p) => p.status === "completed" || p.status === "failed"
          );

          if (allDone) {
            const completedCount = currentPosts.filter(
              (p) => p.status === "completed"
            ).length;
            const failedCount = currentPosts.filter(
              (p) => p.status === "failed"
            ).length;

            send({
              type: "batch_done",
              completed: completedCount,
              failed: failedCount,
            });
            break;
          }

          // Wait 2 seconds before next poll
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        try {
          controller.close();
        } catch {
          // stream already cancelled
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
