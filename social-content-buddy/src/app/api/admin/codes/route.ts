import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invitationCodes, invitationCodeRedemptions, users } from "@/lib/db/schema";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all codes
  const codes = await db
    .select({
      id: invitationCodes.id,
      code: invitationCodes.code,
      maxUses: invitationCodes.maxUses,
      currentUses: invitationCodes.currentUses,
      isActive: invitationCodes.isActive,
      createdAt: invitationCodes.createdAt,
    })
    .from(invitationCodes)
    .orderBy(desc(invitationCodes.createdAt));

  // Get redemptions for all codes
  const redemptions = await db
    .select({
      codeId: invitationCodeRedemptions.codeId,
      userName: users.name,
      userEmail: users.email,
      redeemedAt: invitationCodeRedemptions.redeemedAt,
    })
    .from(invitationCodeRedemptions)
    .innerJoin(users, eq(invitationCodeRedemptions.userId, users.id))
    .orderBy(desc(invitationCodeRedemptions.redeemedAt));

  // Group redemptions by code
  const redemptionsByCode = new Map<string, typeof redemptions>();
  for (const r of redemptions) {
    const list = redemptionsByCode.get(r.codeId) || [];
    list.push(r);
    redemptionsByCode.set(r.codeId, list);
  }

  const result = codes.map((c) => ({
    ...c,
    redemptions: redemptionsByCode.get(c.id) || [],
  }));

  return NextResponse.json(result);
}

const createSchema = z.object({
  maxUses: z.number().int().min(1).max(10000).default(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { maxUses } = parsed.data;

  // Generate a single code with retry on unique constraint violation
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = generateCode();
      const [row] = await db
        .insert(invitationCodes)
        .values({ code, createdBy: session.user.id, maxUses })
        .returning({ code: invitationCodes.code });
      return NextResponse.json({ code: row.code });
    } catch {
      // Unique constraint violation — retry with new code
    }
  }

  return NextResponse.json(
    { error: "Failed to generate unique code after retries" },
    { status: 500 }
  );
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const [code] = await db
    .select()
    .from(invitationCodes)
    .where(eq(invitationCodes.id, id))
    .limit(1);

  if (!code) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }

  await db
    .update(invitationCodes)
    .set({ isActive: false })
    .where(eq(invitationCodes.id, id));

  return NextResponse.json({ success: true });
}
