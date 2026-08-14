import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, generatedPosts } from "@/lib/db/schema";
import { renderDeck, toKoyopoSlides, type RawSlide, type CanvasName } from "@/lib/koyopo";
import { renderEditorialDeck } from "@/lib/deck-render";
import { renderSwipeDeck } from "@/lib/deck-swipe";
import { renderAttnDeck } from "@/lib/deck-attention";
import { buildPptx } from "@/lib/koyopo-pptx";

export const maxDuration = 300;

/**
 * KOYOPO carousel rendering.
 *
 * Deliberately separate from the image-model route next door: this path draws
 * flat brand colours itself, so it needs no image API, no key, and costs nothing
 * to run. It is the reason a carousel can be produced at all on an account with
 * no image budget at all.
 *
 * POST body: { canvas?: "tall" | "wide", format?: "png" | "pptx", style?: "koyopo" | "editorial" | "swipe" }
 *
 * "koyopo" is the locked brand system (flat red, no images). "editorial" is the
 * multi-colour illustrated style with icons and charts. "swipe" is the
 * minimalist creator style — paper ground, one accent, body card + takeaway card
 * — which is what the top-performing LinkedIn decks actually look like. Same
 * slide data, three visual languages.
 */

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ postId: string }> }
) {
  const url = new URL(req.url);
  return handle(ctx, {
    canvas: url.searchParams.get("canvas") ?? undefined,
    format: url.searchParams.get("format") ?? "pptx",
    style: url.searchParams.get("style") ?? undefined,
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ postId: string }> }
) {
  const body = await req.json().catch(() => ({}));
  return handle(ctx, { canvas: body.canvas, format: body.format, style: body.style });
}

async function handle(
  { params }: { params: Promise<{ postId: string }> },
  input: { canvas?: string; format?: string; style?: string }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { postId } = await params;
    const canvas: CanvasName = input.canvas === "wide" ? "wide" : "tall";
    const format: "png" | "pptx" = input.format === "pptx" ? "pptx" : "png";
    const STYLES = ["koyopo", "editorial", "swipe", "attention"] as const;
    type Style = (typeof STYLES)[number];
    const style: Style = (STYLES as readonly string[]).includes(input.style ?? "")
      ? (input.style as Style)
      : "swipe";

    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const raw: RawSlide[] = post.carouselSlides ? safeParse(post.carouselSlides, []) : [];
    if (!raw.length) {
      return NextResponse.json(
        { error: "This post has no carousel slides. Generate it as a Carousel post first." },
        { status: 400 }
      );
    }

    const deckTitle = "1Cr+ Career OS";
    const slides = toKoyopoSlides(raw);

    if (format === "pptx") {
      const buf = await buildPptx(slides, { canvas, deckTitle });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="koyopo-${canvas}-${postId.slice(0, 8)}.pptx"`,
        },
      });
    }

    // The swipe deck is signed with the creator's own name — these decks read as
    // a person's, not a brand's, and the signature is part of that.
    const [profile] = await db
      .select({ fullName: creatorProfiles.fullName })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, session.user.id))
      .limit(1);

    // pptx export stays on the KOYOPO layout engine for now; the editorial and
    // swipe styles are PNG-only until their templates are ported to pptxgenjs.
    const author = profile?.fullName ?? undefined;
    const buffers =
      style === "attention"
        ? await renderAttnDeck(slides, {
            canvas, seed: postId, author,
            cta: author ? { line: `Repost and Follow *${author}* for more content like this` } : undefined,
          })
        : style === "swipe"
          ? await renderSwipeDeck(slides, { canvas, seed: postId, author })
          : style === "editorial"
            ? await renderEditorialDeck(slides, { canvas, deckTitle, seed: postId })
            : await renderDeck(slides, { canvas, deckTitle });
    const dir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(dir, { recursive: true });

    const stamp = Date.now();
    const urls: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
      const filename = `${postId}-${style}-${canvas}-${i}-${stamp}.png`;
      await fs.writeFile(path.join(dir, filename), buffers[i]);
      urls.push(`/generated/${filename}`);
    }

    await db
      .update(generatedPosts)
      .set({ carouselImages: JSON.stringify(urls), imageUrl: urls[0] })
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({ images: urls, count: urls.length, canvas, style });
  } catch (err) {
    const message = err instanceof Error ? err.message : "KOYOPO render failed";
    console.error("KOYOPO render error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParse<T>(v: string, fb: T): T {
  try { return JSON.parse(v); } catch { return fb; }
}
