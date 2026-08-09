import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc, inArray, lt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches } from "@/lib/db/schema";

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/** GET /api/batches?workspace=uuid&limit=5
 *  List batches for the current user, optionally filtered by workspace.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Auto-recover stuck batches: if a batch has been "generating" for >10 min, mark it failed
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    await db
      .update(postBatches)
      .set({ status: "failed", errorMessage: "Generation timed out" })
      .where(
        and(
          eq(postBatches.userId, session.user.id),
          inArray(postBatches.status, ["generating_briefs", "generating_images"]),
          lt(postBatches.createdAt, staleThreshold)
        )
      );

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspace");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const conditions = [eq(postBatches.userId, session.user.id)];
    if (workspaceId) {
      conditions.push(eq(postBatches.workspaceId, workspaceId));
    }

    const batches = await db
      .select()
      .from(postBatches)
      .where(and(...conditions))
      .orderBy(desc(postBatches.createdAt))
      .limit(limit);

    return NextResponse.json(batches);
  } catch (err) {
    console.error("Batches GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
