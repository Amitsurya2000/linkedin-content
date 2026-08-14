import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderProfilePhoto, ASSET_THEMES, PHOTO_STYLES, type AssetThemeName, type PhotoStyle } from "@/lib/asset-render";

export const maxDuration = 60;

/**
 * POST multipart { photo, theme?, style? } — treat an uploaded headshot into a
 * LinkedIn profile photo.
 *
 * The upload is processed and returned in one request and never written to
 * disk: a face is the most personal thing this app touches, and there is no
 * reason to keep a copy on the server to hand back a PNG.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a photo." }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo too large (max 15MB)." }, { status: 400 });
    }

    const themeRaw = String(form.get("theme") ?? "navy");
    const styleRaw = String(form.get("style") ?? "ring");
    const theme: AssetThemeName = themeRaw in ASSET_THEMES ? (themeRaw as AssetThemeName) : "navy";
    const style: PhotoStyle = (PHOTO_STYLES as readonly string[]).includes(styleRaw) ? (styleRaw as PhotoStyle) : "ring";

    const png = await renderProfilePhoto(buf, { theme, style });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="linkedin-profile-photo-${style}-${theme}.png"`,
      },
    });
  } catch (err) {
    // An unreadable upload (HEIC, a PDF renamed to .jpg) lands here.
    const message = err instanceof Error ? err.message : "Could not process that photo";
    console.error("Profile photo error:", err);
    return NextResponse.json({ error: `Could not read that image. Try a JPG or PNG. (${message})` }, { status: 400 });
  }
}
