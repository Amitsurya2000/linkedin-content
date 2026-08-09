import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, invitationCodes, invitationCodeRedemptions } from "@/lib/db/schema";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  inviteCode: z.string().min(1).max(30),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, inviteCode } = parsed.data;

    // Hash password before transaction to keep lock time short
    const passwordHash = await bcryptjs.hash(password, 12);

    // Wrap in transaction with row lock to prevent race conditions
    const result = await db.transaction(async (tx) => {
      // Lock the invite code row — second concurrent request waits here
      const [code] = await tx
        .select()
        .from(invitationCodes)
        .where(eq(invitationCodes.code, inviteCode.toUpperCase()))
        .limit(1)
        .for("update");

      if (!code || !code.isActive || code.currentUses >= code.maxUses) {
        return { error: "Invalid or fully used invitation code" } as const;
      }

      // Check if email already exists
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        return { error: "Email already registered" } as const;
      }

      // Create user
      const [newUser] = await tx
        .insert(users)
        .values({
          name,
          email,
          password: passwordHash,
          invitedByCode: code.id,
        })
        .returning({ id: users.id, email: users.email });

      // Increment usage count
      await tx
        .update(invitationCodes)
        .set({
          currentUses: sql`${invitationCodes.currentUses} + 1`,
        })
        .where(eq(invitationCodes.id, code.id));

      // Record redemption
      await tx
        .insert(invitationCodeRedemptions)
        .values({
          codeId: code.id,
          userId: newUser.id,
        });

      return { success: true, userId: newUser.id } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
