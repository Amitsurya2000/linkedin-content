import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, generatedPosts, postBatches, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { renderDeck, toKoyopoSlides, type RawSlide, type CanvasName } from "@/lib/koyopo";
import { renderEditorialDeck } from "@/lib/deck-render";
import { renderSwipeDeck } from "@/lib/deck-swipe";
import { renderAttnDeck } from "@/lib/deck-attention";
import { renderVisualDeck } from "@/lib/deck-visual";
import { renderCampaignDeck } from "@/lib/deck-campaign";
import { renderLabDeck, LAB_STYLES, type LabStyleName } from "@/lib/deck-lab";
import { buildPptxFromImages } from "@/lib/koyopo-pptx";

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
    maxSlides: Number(url.searchParams.get("maxSlides")) || undefined,
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ postId: string }> }
) {
  const body = await req.json().catch(() => ({}));
  return handle(ctx, {
    canvas: body.canvas, format: body.format, style: body.style,
    maxSlides: body.maxSlides, generateArt: body.generateArt,
  });
}

/**
 * Trim a deck to `max` slides while keeping its shape.
 *
 * A plain `slice` would drop the closing CTA, which is the slide every deck is
 * built to arrive at — so the cover and the final slide are always kept and the
 * middle is what gets cut.
 */
function limitSlides(raw: RawSlide[], max?: number): RawSlide[] {
  if (!max || max >= raw.length) return raw;
  // 1 slide = the cover alone; 2 = cover + CTA. Below 3 there is no middle to
  // keep, so the "cover + … + CTA" rule does not apply.
  if (max === 1) return raw.slice(0, 1);
  return [...raw.slice(0, max - 1), raw[raw.length - 1]];
}

async function handle(
  { params }: { params: Promise<{ postId: string }> },
  input: { canvas?: string; format?: string; style?: string; maxSlides?: number; generateArt?: boolean }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { postId } = await params;
    const canvas: CanvasName = input.canvas === "wide" ? "wide" : "tall";
    const format: "png" | "pptx" = input.format === "pptx" ? "pptx" : "png";
    const STYLES = ["koyopo", "editorial", "swipe", "attention", "visual", "campaign"] as const;
    // Spec-driven styles live in their own table; any name in it is valid.
    const labStyle = input.style && input.style in LAB_STYLES ? (input.style as LabStyleName) : null;
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

    // .pptx is built from the slides ALREADY on screen, not from a fresh render.
    //
    // It used to return here from buildPptx(), a text-based rebuild that only the
    // KOYOPO layout had templates for — so picking Campaign or Walkthrough and
    // hitting .pptx silently produced a KOYOPO deck. Re-rendering here instead
    // would fix the style but introduce two new problems: on the art styles it
    // would generate fresh images, so the file would not match the preview and
    // would spend Gemini quota on a download.
    //
    // Reading back what was rendered avoids all three. The file is exactly the
    // deck the user approved, it costs nothing, and it is correct for all fifteen
    // styles without pptxgenjs needing to know any of them.
    if (format === "pptx") {
      const stored: string[] = post.carouselImages ? safeParse(post.carouselImages, []) : [];
      if (!stored.length) {
        return NextResponse.json(
          { error: "Render the deck first — the .pptx is built from the slides on screen." },
          { status: 400 }
        );
      }
      const frames: Buffer[] = [];
      for (const url of stored) {
        frames.push(await fs.readFile(path.join(process.cwd(), "public", url.replace(/^\/+/, ""))));
      }
      const buf = await buildPptxFromImages(frames, { deckTitle });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="deck-${postId.slice(0, 8)}.pptx"`,
        },
      });
    }

    const slides = toKoyopoSlides(limitSlides(raw, input.maxSlides));

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

    // The illustrated deck needs three things the others do not: the client's
    // uploaded images, the per-slide art briefs, and a key to generate the rest.
    let visualExtras: {
      referenceImages?: string[];
      designDirections?: (string | undefined)[];
      geminiKey?: string;
      topic?: string;
    } = {};
    if (style === "visual" || labStyle) {
      const [batch] = await db
        .select({ referenceImages: postBatches.referenceImages, topic: postBatches.topic })
        .from(postBatches)
        .where(eq(postBatches.id, post.batchId))
        .limit(1);
      const [keyRow] = await db
        .select()
        .from(userApiKeys)
        .where(and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, "gemini")))
        .limit(1);
      visualExtras = {
        referenceImages: batch?.referenceImages ? safeParse<string[]>(batch.referenceImages, []) : [],
        designDirections: limitSlides(raw, input.maxSlides).map((s2) => (s2 as RawSlide & { designDirection?: string }).designDirection),
        geminiKey: keyRow ? decrypt(keyRow.encryptedKey, keyRow.iv, keyRow.authTag) : undefined,
        topic: batch?.topic,
      };
    }

    const buffers = labStyle
      ? await renderLabDeck(slides, {
          style: labStyle, author,
          generateArt: input.generateArt === true,
          ...visualExtras,
        })
      : style === "campaign"
        ? await renderCampaignDeck(slides, { seed: postId, brand: author })
        : style === "visual"
        ? await renderVisualDeck(slides, {
            seed: postId, author, pageTotal: slides.length,
            generateArt: input.generateArt === true,
            ...visualExtras,
          })
        : style === "attention"
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
