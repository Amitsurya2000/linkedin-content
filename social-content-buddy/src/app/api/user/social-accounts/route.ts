import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { socialAccounts, workspaces, workspaceMembers } from "@/lib/db/schema";
import { getUserApiKey } from "@/lib/crypto";
import { listAccounts } from "@/lib/getlate";

/** GET — Return social accounts.
 *  Optional ?workspace=uuid to filter by workspace.
 *  Optional ?sync=true to sync from GetLate (use after OAuth or explicit "Sync" button).
 *  Without ?sync=true, only returns cached accounts from DB — no auto-sync.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspace");
  const shouldSync = url.searchParams.get("sync") === "true";

  // Only sync from GetLate when explicitly requested
  if (shouldSync) {
    const apiKey = await getUserApiKey(userId, "getlate");
    if (apiKey) {
      try {
        const remote = await listAccounts(apiKey);

        await db.transaction(async (tx) => {
          const existing = await tx
            .select({ accountId: socialAccounts.accountId, workspaceId: socialAccounts.workspaceId })
            .from(socialAccounts)
            .where(eq(socialAccounts.userId, userId));
          const wsMap = new Map(existing.map((e) => [e.accountId, e.workspaceId]));

          await tx.delete(socialAccounts).where(eq(socialAccounts.userId, userId));

          if (remote.length > 0) {
            await tx.insert(socialAccounts).values(
              remote.map((a) => ({
                userId,
                workspaceId: wsMap.get(a._id) ?? null,
                platform: a.platform,
                accountId: a._id,
                username: a.username ?? null,
                displayName: a.displayName ?? null,
              }))
            );
          }
        });
      } catch (err) {
        console.error("GetLate sync error:", err);
      }
    }
  }

  // Return cached accounts from DB
  const conditions = [eq(socialAccounts.userId, userId)];
  if (workspaceId) conditions.push(eq(socialAccounts.workspaceId, workspaceId));
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(and(...conditions));

  return NextResponse.json(accounts);
}

const patchSchema = z.object({
  accountId: z.string(),
  workspaceId: z.string().uuid().nullable(),
});

/** PATCH — Link or unlink a social account to/from a workspace */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { accountId, workspaceId } = parsed.data;
  const userId = session.user.id;

  // Verify workspace membership before linking
  if (workspaceId) {
    const [isOwner] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
      .limit(1);

    if (!isOwner) {
      const [isMember] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId)
          )
        )
        .limit(1);

      if (!isMember) {
        return NextResponse.json(
          { error: "You do not have access to this workspace" },
          { status: 403 }
        );
      }
    }
  }

  // Atomic: unlink existing + link new in one transaction
  const updated = await db.transaction(async (tx) => {
    if (workspaceId) {
      await tx
        .update(socialAccounts)
        .set({ workspaceId: null })
        .where(
          and(
            eq(socialAccounts.userId, userId),
            eq(socialAccounts.workspaceId, workspaceId)
          )
        );
    }

    const [result] = await tx
      .update(socialAccounts)
      .set({ workspaceId })
      .where(
        and(
          eq(socialAccounts.userId, userId),
          eq(socialAccounts.accountId, accountId)
        )
      )
      .returning();

    return result;
  });

  if (!updated) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

const deleteSchema = z.object({
  accountId: z.string(),
});

/** DELETE — Remove a social account from local DB */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await db
    .delete(socialAccounts)
    .where(
      and(
        eq(socialAccounts.userId, session.user.id),
        eq(socialAccounts.accountId, parsed.data.accountId)
      )
    );

  return NextResponse.json({ success: true });
}
