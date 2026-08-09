import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, users } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const batches = await db
      .select({
        id: postBatches.id,
        businessName: postBatches.businessName,
        websiteUrl: postBatches.websiteUrl,
        postsCount: postBatches.postsCount,
        status: postBatches.status,
        createdAt: postBatches.createdAt,
        completedAt: postBatches.completedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(postBatches)
      .leftJoin(users, eq(postBatches.userId, users.id))
      .orderBy(desc(postBatches.createdAt))
      .limit(100);

    return NextResponse.json(batches);
  } catch (err) {
    console.error("Admin posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
