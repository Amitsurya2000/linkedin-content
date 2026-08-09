import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { isUnsafeUrl } from "@/lib/validation";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  businessName: z.string().min(1).max(200).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  targetAudience: z.string().max(500).optional(),
  tonePrefs: z.string().max(500).optional(),
  logoUrl: z.string().nullable().optional(),
  brandColors: z.array(z.string()).optional(),
  brandFonts: z.record(z.string(), z.string()).optional(),
  brandGuidelines: z.string().max(2000).optional(),
  timezone: z.string().optional(),
});

/** GET — Get a single workspace */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId } = await params;

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, session.user.id)))
      .limit(1);

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json(workspace);
  } catch (err) {
    console.error("Workspace GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** PATCH — Update a workspace */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Verify ownership
    const [existing] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, session.user.id)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    // Convert empty websiteUrl to null
    if (updates.websiteUrl === "") updates.websiteUrl = null;

    if (typeof updates.websiteUrl === "string" && isUnsafeUrl(updates.websiteUrl)) {
      return NextResponse.json({ error: "Invalid or unsafe website URL" }, { status: 400 });
    }

    const [updated] = await db
      .update(workspaces)
      .set(updates)
      .where(eq(workspaces.id, workspaceId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Workspace update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — Delete a workspace */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId } = await params;

    const [deleted] = await db
      .delete(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, session.user.id)))
      .returning({ id: workspaces.id });

    if (!deleted) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Workspace delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
