import { NextRequest, NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaAssets, workspaces, workspaceMembers } from "@/lib/db/schema";
import { validateImageFile, uploadBuffer, deleteAsset } from "@/lib/storage";

const MAX_MEDIA_PER_WORKSPACE = 100;

/** Verify user has access to workspace (owner or member) */
async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const [isOwner] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
    .limit(1);
  if (isOwner) return true;

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
  return !!isMember;
}

/** GET /api/media?workspace=<uuid> — List media assets for a workspace */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get("workspace");
  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspace query param is required" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId, session.user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assets = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.workspaceId, workspaceId))
    .orderBy(mediaAssets.createdAt);

  return NextResponse.json({ assets });
}

/** POST /api/media — Upload a media asset to a workspace */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const workspaceId = formData.get("workspaceId") as string | null;

    if (!file || !workspaceId) {
      return NextResponse.json(
        { error: "Missing file or workspaceId" },
        { status: 400 }
      );
    }

    // Verify workspace access
    const hasAccess = await verifyWorkspaceAccess(workspaceId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate file
    const validationError = validateImageFile(file.type, file.size);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Check cap
    const [{ value: currentCount }] = await db
      .select({ value: count() })
      .from(mediaAssets)
      .where(eq(mediaAssets.workspaceId, workspaceId));

    if (currentCount >= MAX_MEDIA_PER_WORKSPACE) {
      return NextResponse.json(
        {
          error: `Media library is full (max ${MAX_MEDIA_PER_WORKSPACE} images). Delete some images to upload more.`,
        },
        { status: 400 }
      );
    }

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `assets/${workspaceId}/media/${crypto.randomUUID()}.${ext}`;
    const url = await uploadBuffer(buffer, key, file.type);

    // Save to DB
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        workspaceId,
        userId,
        url,
        filename: file.name || `image.${ext}`,
        contentType: file.type,
        sizeBytes: file.size,
      })
      .returning();

    return NextResponse.json({ asset });
  } catch (err) {
    console.error("Media upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

/** DELETE /api/media — Delete a media asset */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Find the asset and verify ownership
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);

    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(
      asset.workspaceId,
      session.user.id
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete from R2 (best-effort)
    try {
      await deleteAsset(asset.url);
    } catch {
      console.error("Failed to delete from R2:", asset.url);
    }

    // Delete from DB
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Media delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
