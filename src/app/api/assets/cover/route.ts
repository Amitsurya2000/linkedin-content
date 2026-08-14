import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderCover, ASSET_THEMES, COVER_SIZES, type AssetThemeName, type CoverSize } from "@/lib/asset-render";

export const maxDuration = 60;

/**
 * GET — render a cover card as PNG from query params.
 *
 * Stateless on purpose: the copy already lives in the generated asset on the
 * client, so passing it back here avoids storing every cover variant the user
 * flips through while choosing a theme.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const headline = (q.get("headline") ?? "").slice(0, 120);
  if (!headline.trim()) return NextResponse.json({ error: "headline is required" }, { status: 400 });

  const themeParam = q.get("theme") as AssetThemeName | null;
  const sizeParam = q.get("size") as CoverSize | null;
  const theme: AssetThemeName = themeParam && themeParam in ASSET_THEMES ? themeParam : "navy";
  const size: CoverSize = sizeParam && sizeParam in COVER_SIZES ? sizeParam : "featured";
  const download = q.get("download") === "1";

  const png = await renderCover(
    {
      headline,
      kicker: (q.get("kicker") ?? "").slice(0, 30) || undefined,
      sub: (q.get("sub") ?? "").slice(0, 200) || undefined,
      footer: (q.get("footer") ?? "").slice(0, 60) || undefined,
    },
    { theme, size, scale: q.get("scale") === "1" ? 1 : 2 }
  );

  const slug = headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${slug || "cover"}-${size}.png"` } : {}),
    },
  });
}
