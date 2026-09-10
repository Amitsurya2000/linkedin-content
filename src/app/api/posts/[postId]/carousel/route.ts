import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches } from "@/lib/db/schema";
import { resolveGeminiKey } from "@/lib/api-keys";
import { generateBackground, newSeed } from "@/lib/image-engine";
import { buildStyledPrompt } from "@/lib/image-prompt";
import { composeSlide, type SlideSpec, type OverlayTheme } from "@/lib/compose";
import { storePostImages } from "@/lib/store-images";

export const maxDuration = 300;

// Clean, EVEN backgrounds only — carousels need consistent legibility behind
// multi-line text, so gradients / photos / busy styles are excluded.
const CAROUSEL_STYLES = [
  "authority-quote", "authority-glow", "authority-smoke", "executive-navy", "charcoal-gold",
];

interface Slide {
  slideNumber?: number;
  title: string;
  body?: string;
  // Written by src/lib/carousel-prompt.ts. Absent on decks generated before it,
  // which fall back to the old preset path.
  slideType?: "hook" | "stakes" | "content" | "recap" | "cta";
  badge?: string | null;
  imagePrompt?: string;
  design?: {
    bgHex?: string;
    accentHex?: string;
    textHex?: string;
    typeDirection?: string;
    visualTheme?: string;
  };
}

/**
 * A background prompt for the deck as a whole.
 *
 * Used as the shared fallback: if one slide's own background call fails, that
 * slide still lands on something from the right visual theme rather than black.
 */
function deckFallbackPrompt(slides: Slide[]): string {
  const d = slides[0]?.design ?? {};
  return (
    slides.find((s) => s.imagePrompt)?.imagePrompt ||
    `A flat minimal background in ${d.bgHex || "#0B1F3A"} with a ${d.accentHex || "#E8B44A"} accent, subtle organic texture, large empty area reserved for text overlay, not glossy. ABSOLUTELY NO text, no words, no letters, no numbers, no typography, no captions, no watermark, no logos.`
  );
}

/** Does this deck carry a builder design system and per-slide background prompts? */
function isBuilderDeck(slides: Slide[]): boolean {
  return !!slides[0]?.design?.bgHex && slides.some((s) => !!s.imagePrompt);
}

/**
 * The overlay theme the model chose, rather than one of the five presets.
 *
 * The prompt builder draws a visual theme per render and states its exact hexes;
 * honouring them is what makes two renders of the same topic look genuinely
 * different instead of recoloured.
 */
function builderTheme(slides: Slide[]): OverlayTheme {
  const d = slides[0]?.design ?? {};
  const dir = (d.typeDirection || "").toLowerCase();
  const font: OverlayTheme["font"] = dir.includes("mono")
    ? "mono"
    : dir.includes("serif")
      ? "serif"
      : "sans";
  // The deck background is a photo-style image with a large text zone, so a
  // plain drop shadow is rarely enough for AA contrast across the whole block.
  // A light background takes a light glass panel (dark text keeps contrast);
  // a dark / medium background takes a dark panel (white text pops).
  const scrim: OverlayTheme["scrim"] = readableOn(d.bgHex || "#FFFFFF") === "#141414" ? "panel-light" : "panel-dark";
  return {
    fg: d.textHex || "#FFFFFF",
    accent: d.accentHex || "#E8B44A",
    font,
    align: "center",
    scrim,
  };
}

/** Pick black or white text for best contrast on a given hex background. */
function readableOn(hex: string): string {
  const m = (hex || "#FFFFFF").replace("#", "");
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#141414" : "#FFFFFF";
}

/** POST — generate a multi-slide carousel (cover + content slides + CTA). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Backgrounds come from the user's Gemini key — checked with the post below.

  try {
    const { postId } = await params;
    const body = await req.json().catch(() => ({}));

    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Render every slide Gemini wrote, or the requested subset. The old hard cap
    // of 5 predated variable-length decks and silently threw away half of a
    // 10-slide deck.
    const allSlides: Slide[] = post.carouselSlides ? safeParse(post.carouselSlides, []) : [];
    const max = Number(body.maxSlides);
    const slides =
      max >= 1 && max < allSlides.length
        ? max === 1
          ? allSlides.slice(0, 1)
          : [...allSlides.slice(0, max - 1), allSlides[allSlides.length - 1]]
        : allSlides;

    const [batch] = await db
      .select({ topic: postBatches.topic, industry: postBatches.industry })
      .from(postBatches)
      .where(eq(postBatches.id, post.batchId))
      .limit(1);

    // A builder deck brings its own colours and its own per-slide background
    // prompts; anything older still goes through the five-preset path.
    const builder = isBuilderDeck(slides);

    // Choose one cohesive style for the whole deck.
    const styleId =
      typeof body.style === "string" && CAROUSEL_STYLES.includes(body.style)
        ? body.style
        : CAROUSEL_STYLES[Math.floor(Math.random() * CAROUSEL_STYLES.length)];

    const built = buildStyledPrompt(
      { hook: post.hook, hookCategory: post.hookCategory, topic: batch?.topic || undefined, industry: batch?.industry || undefined, cta: post.cta || undefined },
      styleId
    );
    const theme: OverlayTheme = builder
      ? builderTheme(slides)
      : built.overlay?.theme ?? { fg: "#FFFFFF", accent: "#C9A227", font: "serif", align: "center", scrim: "none" };
    // 1080x1350 is LinkedIn's 4:5 document slot. The preset sizes only apply to
    // the old path, where the background style fixes its own dimensions.
    const { width, height } = builder ? { width: 1080, height: 1350 } : built;

    const geminiKey = (await resolveGeminiKey(session.user.id)) || undefined;

    // One shared, cohesive background for the whole carousel (fast + consistent).
    // Used for the old path, and as the fallback for any builder slide whose own
    // background fails — a deck that renders 9 of 10 slides is still a deck.
    const bg = await generateBackground(builder ? deckFallbackPrompt(slides) : built.prompt, {
      width,
      height,
      seed: newSeed(),
      geminiKey,
    });
    const bgBuf = bg.buffer;

    // One image per Gemini slide — nothing dropped, nothing truncated. Slide 1 =
    // cover, last = CTA, the rest = content. Full copy is rendered verbatim.
    const badge = theme.badge || "Carousel";
    const specs: SlideSpec[] = [];
    if (builder) {
      // The model already assigned every slide its role and its badge, so the
      // position-based guessing below is not used here.
      const total = slides.length;
      slides.forEach((sl, i) => {
        const kind: SlideSpec["kind"] =
          sl.slideType === "hook" ? "cover" : sl.slideType === "cta" ? "cta" : "content";
        specs.push(
          kind === "content"
            ? {
                kind,
                number: sl.badge || String(i + 1).padStart(2, "0"),
                title: sl.title,
                body: (sl.body || "").replace(/\s+/g, " ").trim(),
                footer: `${i + 1} / ${total}`,
              }
            : { kind, badge: sl.badge || badge, title: sl.title }
        );
      });
    } else if (slides.length === 0) {
      specs.push({ kind: "cover", badge, title: post.hook });
      specs.push({ kind: "cta", title: post.cta || "Follow for more", badge });
    } else {
      const total = slides.length;
      slides.forEach((s, i) => {
        const cleanBody = (s.body || "").replace(/\s+/g, " ").trim();
        if (i === 0) {
          specs.push({ kind: "cover", badge, title: s.title || post.hook });
        } else if (i === slides.length - 1) {
          specs.push({ kind: "cta", title: s.title || post.cta || "Follow for more", badge });
        } else {
          specs.push({
            kind: "content",
            number: String(i).padStart(2, "0"),
            title: s.title,
            body: cleanBody,
            footer: `${i + 1} / ${total}`,
          });
        }
      });
    }

    // Store every rendered slide in the database and point the post at the
    // resulting proxy URLs. On serverless there is no writable disk to serve
    // static files from, so the DB is the only persistent store.
    // Generate slide backgrounds in batches of 3 instead of one-by-one.
    // The image model takes ~30-125s per generation, so running them 3 at a
    // time turns a 7-slide deck from ~7× worst-case into ~3× worst-case without
    // exhausting the serverless function's memory.
    const BATCH_SIZE = 3;
    const slideBgs: Buffer[] = new Array(specs.length).fill(bgBuf);

    for (let batch = 0; batch < specs.length; batch += BATCH_SIZE) {
      const slice = specs.slice(batch, batch + BATCH_SIZE);
      const results = await Promise.allSettled(
        slice.map((spec, j) => {
          const i = batch + j;
          if (!builder) return Promise.resolve(bgBuf);
          const p = slides[i]?.imagePrompt;
          if (!p) return Promise.resolve(bgBuf);
          return generateBackground(p, { width, height, seed: newSeed(), geminiKey }).then((r) => r.buffer);
        })
      );
      results.forEach((r, j) => {
        if (r.status === "rejected") {
          console.error(`Slide ${batch + j + 1} background failed, using the deck background:`, r.reason);
        } else {
          slideBgs[batch + j] = r.value;
        }
      });
    }

    const buffers = await Promise.all(
      specs.map((spec, i) => composeSlide(slideBgs[i], { width, height, slide: spec, theme }))
    );

    const urls = await storePostImages(session.user.id, buffers, postId);

    await db
      .update(generatedPosts)
      .set({ carouselImages: JSON.stringify(urls), imageUrl: urls[0] })
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({ images: urls, count: urls.length, style: styleId, styleName: built.styleName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Carousel generation failed";
    console.error("Carousel generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParse<T>(v: string, fb: T): T {
  try { return JSON.parse(v); } catch { return fb; }
}
