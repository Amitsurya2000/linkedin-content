import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles } from "@/lib/db/schema";
import { renderBanner, BANNER_THEMES, type BannerThemeName, type BannerVisual } from "@/lib/banner";
import type { ProfileKit } from "@/lib/profile-kit";

export const maxDuration = 60;

/**
 * Renders the saved banner brief to a real 1584×396 PNG.
 *
 * `?download=1` sends it as an attachment; without it the same URL is a plain
 * image, which is what the preview `<img>` on the branding page points at. The
 * theme and diagram can be overridden per request so the user can flip through
 * looks without regenerating the copy.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ kitJson: creatorProfiles.kitJson })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, session.user.id))
    .limit(1);

  if (!row?.kitJson) {
    return NextResponse.json({ error: "No banner yet — generate your profile kit first." }, { status: 400 });
  }

  const kit = JSON.parse(row.kitJson) as ProfileKit;
  const url = new URL(req.url);
  const themeParam = url.searchParams.get("theme") as BannerThemeName | null;
  const visualParam = url.searchParams.get("visual") as BannerVisual | null;
  const theme: BannerThemeName = themeParam && themeParam in BANNER_THEMES ? themeParam : "navy";
  const download = url.searchParams.get("download") === "1";
  // 2x by default: LinkedIn resamples the upload, and a 1x banner visibly softens.
  const scale = url.searchParams.get("scale") === "1" ? 1 : 2;

  const png = await renderBanner(
    { ...kit.banner, visual: visualParam ?? kit.banner.visual },
    { theme, scale }
  );

  const safeName = (kit.banner.name || "linkedin").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${safeName}-linkedin-banner-${theme}.png"` }
        : {}),
    },
  });
}
