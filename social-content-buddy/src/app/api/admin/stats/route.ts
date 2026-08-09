import { NextResponse } from "next/server";
import { eq, count, sum, gte, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, postBatches, generatedPosts } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalBatches] = await db.select({ count: count() }).from(postBatches);
    const [totalPosts] = await db.select({ count: count() }).from(generatedPosts);
    const [todayBatches] = await db
      .select({ count: count() })
      .from(postBatches)
      .where(gte(postBatches.createdAt, today));
    const [weekBatches] = await db
      .select({ count: count() })
      .from(postBatches)
      .where(gte(postBatches.createdAt, weekAgo));
    const [creditsConsumed] = await db
      .select({ total: sum(users.creditsUsed) })
      .from(users);

    const recentUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        creditsUsed: users.creditsUsed,
        creditsLimit: users.creditsLimit,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);

    return NextResponse.json({
      totalUsers: totalUsers.count,
      totalBatches: totalBatches.count,
      totalPosts: totalPosts.count,
      todayBatches: todayBatches.count,
      weekBatches: weekBatches.count,
      creditsConsumed: creditsConsumed.total ?? 0,
      recentUsers,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
