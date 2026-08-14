import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postMetrics } from "@/lib/db/schema";
import { computeInsights, type MetricRow } from "@/lib/analytics";

/** GET — every logged post plus the computed insights. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.userId, session.user.id))
    .orderBy(desc(postMetrics.postedAt));

  return NextResponse.json({ rows, insights: computeInsights(rows as MetricRow[]) });
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return isFinite(n) ? Math.round(n) : null;
};

/** POST — log one post's numbers. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label && !b.postId) {
    return NextResponse.json({ error: "Give the post a label so you can recognise it later." }, { status: 400 });
  }

  const postedAt = b.postedAt ? new Date(b.postedAt) : new Date();
  await db.insert(postMetrics).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    postId: typeof b.postId === "string" ? b.postId : null,
    label: label || null,
    postType: typeof b.postType === "string" ? b.postType : null,
    hookCategory: typeof b.hookCategory === "string" ? b.hookCategory : null,
    impressions: num(b.impressions),
    reactions: num(b.reactions),
    comments: num(b.comments),
    reposts: num(b.reposts),
    saves: num(b.saves),
    profileViews: num(b.profileViews),
    postedAt: isNaN(postedAt.getTime()) ? new Date() : postedAt,
    notes: typeof b.notes === "string" ? b.notes.slice(0, 500) : null,
  });

  return NextResponse.json({ ok: true });
}

/** DELETE ?id= — remove one logged row. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await db.delete(postMetrics).where(and(eq(postMetrics.id, id), eq(postMetrics.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
