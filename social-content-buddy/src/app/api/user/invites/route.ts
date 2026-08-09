import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  workspaces,
  workspaceInvites,
  users,
} from "@/lib/db/schema";

/** GET — List pending invites for the current user (by email match) */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get current user's email
    const [currentUser] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser?.email) {
      return NextResponse.json([]);
    }

    // Fetch pending invites matching user email, joined with workspace + inviter
    const invites = await db
      .select({
        id: workspaceInvites.id,
        role: workspaceInvites.role,
        createdAt: workspaceInvites.createdAt,
        expiresAt: workspaceInvites.expiresAt,
        workspaceId: workspaceInvites.workspaceId,
        workspaceName: workspaces.name,
        inviterName: users.name,
        inviterEmail: users.email,
      })
      .from(workspaceInvites)
      .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
      .innerJoin(users, eq(workspaceInvites.invitedByUserId, users.id))
      .where(
        and(
          eq(workspaceInvites.email, currentUser.email),
          eq(workspaceInvites.status, "pending")
        )
      );

    // Filter out expired invites on the application side
    const now = new Date();
    const activeInvites = invites.filter((invite) => invite.expiresAt > now);

    return NextResponse.json(activeInvites);
  } catch (err) {
    console.error("User invites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
