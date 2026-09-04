import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedImages } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * Serve a stored generated image.
 *
 * Vercel serverless has a read-only filesystem, so images live in the database
 * (stored base64 in `generated_images`) and are served back through this route.
 * Ownership is checked so a user can only fetch their own images.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageId } = await params;
    const [row] = await db
      .select({ data: generatedImages.data, mimeType: generatedImages.mimeType })
      .from(generatedImages)
      .where(
        and(eq(generatedImages.id, imageId), eq(generatedImages.userId, session.user.id))
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(row.data, "base64"), {
      headers: {
        "Content-Type": row.mimeType || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Image proxy error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
