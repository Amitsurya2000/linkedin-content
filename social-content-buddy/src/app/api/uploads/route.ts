import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import {
  validateImageFile,
  uploadBuffer,
  logoAssetKey,
  productAssetKey,
  deleteAsset,
} from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "logo" | "product"
    const workspaceId = formData.get("workspaceId") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { error: "Missing file or type" },
        { status: 400 }
      );
    }

    if (type !== "logo" && type !== "product") {
      return NextResponse.json(
        { error: "Type must be 'logo' or 'product'" },
        { status: 400 }
      );
    }

    // Validate file
    const validationError = validateImageFile(file.type, file.size);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Logo uploads require a workspaceId and membership verification
    if (type === "logo") {
      if (!workspaceId) {
        return NextResponse.json(
          { error: "workspaceId is required for logo uploads" },
          { status: 400 }
        );
      }

      // Verify workspace ownership or membership
      const [isOwner] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId))
        )
        .limit(1);

      if (!isOwner) {
        const [isMember] = await db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, userId),
              eq(workspaceMembers.role, "owner")
            )
          )
          .limit(1);

        if (!isMember) {
          return NextResponse.json(
            { error: "Only workspace owners can upload logos" },
            { status: 403 }
          );
        }
      }
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate R2 key and upload
    let key: string;
    if (type === "logo") {
      key = logoAssetKey(userId, file.type);
    } else {
      key = productAssetKey(userId);
    }

    const url = await uploadBuffer(buffer, key, file.type);

    // For logos, update the workspace record
    if (type === "logo" && workspaceId) {
      // Delete old logo if it exists
      const [workspace] = await db
        .select({ logoUrl: workspaces.logoUrl })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (workspace?.logoUrl) {
        try {
          await deleteAsset(workspace.logoUrl);
        } catch {
          // Old logo cleanup is best-effort
        }
      }

      await db
        .update(workspaces)
        .set({ logoUrl: url, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
