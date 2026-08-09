import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  workspaceMembers,
  workspaceInvites,
  users,
} from "@/lib/db/schema";

const acceptSchema = z.object({
  inviteId: z.string().uuid(),
});

/** POST — Accept a workspace invite */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { inviteId } = parsed.data;

  // Get current user's email
  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!currentUser?.email) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  try {
    // Everything inside a single transaction with FOR UPDATE lock on the invite row
    const member = await db.transaction(async (tx) => {
      // Lock the invite row — only one request can process this invite at a time
      const [invite] = await tx
        .select()
        .from(workspaceInvites)
        .where(eq(workspaceInvites.id, inviteId))
        .for("update");

      if (!invite) {
        throw new TxError("Invite not found", 404);
      }

      if (invite.status !== "pending") {
        throw new TxError("Invite is no longer pending", 400);
      }

      // Check expiry
      if (new Date() > invite.expiresAt) {
        await tx
          .update(workspaceInvites)
          .set({ status: "expired" })
          .where(eq(workspaceInvites.id, inviteId));
        throw new TxError("Invite has expired", 400);
      }

      // Invite email must match
      if (invite.email.toLowerCase() !== currentUser.email!.toLowerCase()) {
        throw new TxError("This invite was sent to a different email address", 403);
      }

      // Check if already a member
      const [existingMember] = await tx
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invite.workspaceId),
            eq(workspaceMembers.userId, session.user.id)
          )
        )
        .limit(1);

      if (existingMember) {
        await tx
          .update(workspaceInvites)
          .set({ status: "accepted" })
          .where(eq(workspaceInvites.id, inviteId));
        throw new TxError("You are already a member of this workspace", 409);
      }

      // Create membership + mark invite accepted atomically
      const [m] = await tx
        .insert(workspaceMembers)
        .values({
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          role: invite.role,
          invitedByUserId: invite.invitedByUserId,
        })
        .returning();

      await tx
        .update(workspaceInvites)
        .set({ status: "accepted" })
        .where(eq(workspaceInvites.id, inviteId));

      return m;
    });

    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    if (err instanceof TxError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Accept invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Helper to throw structured errors from inside a transaction */
class TxError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
