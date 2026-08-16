import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { type KoyopoSlide, type SlideTemplate } from "./koyopo";
import { generateBackground } from "./image-engine";

/**
 * Illustrated deck — the style with real pictures in it.
 *
 * Every other renderer here is type-only. This one puts an actual image on each
 * slide: a photograph, an illustration, a cartoon, a diagram — whatever the
 * slide's own `designDirection` calls for. That field has always been written by
 * the generator and never used by anything; it is a per-slide art brief sitting
 * unread, and this renderer is what finally consumes it.
 *
 * Image sources, in priority order:
 *   1. Files the client uploaded with the brief. A real photo of the real thing
 *      beats anything a model invents, so uploads are used first and cycled.
 *   2. Generated from the slide's designDirection via the shared image engine
 *      (Gathos, falling back to Gemini).
 *   3. Nothing — the slide degrades to a clean type-only layout rather than
 *      failing the whole deck.
 *
 * Layout is the one human illustrators keep returning to: image occupying the
 * upper two-thirds, copy beneath it on a paper ground. It survives the feed
 * thumbnail because the picture is the first thing that reads.
 */

export const VISUAL_CANVAS = { width: 1080, height: 1350 } as const;

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

export interface VisualTheme {
  bg: string;
  card: string;
  ink: string;
  body: string;
  muted: string;
  accent: string;
  onAccent: string;
}

export const VISUAL_THEMES: Record<string, VisualTheme> = {
  paper: { bg: "#F7F4EF", card: "#EFE7DA", ink: "#1C1917", body: "#4A443E", muted: "#94897E", accent: "#DF5638", onAccent: "#FFFFFF" },
  slate: { bg: "#F5F7F9", card: "#E7EDF3", ink: "#0F1D2E", body: "#3E4C5C", muted: "#8497A9", accent: "#1D4ED8", onAccent: "#FFFFFF" },
  sage:  { bg: "#F4F6F2", card: "#E6EDE3", ink: "#16241C", body: "#414D45", muted: "#879186", accent: "#2F7A5B", onAccent: "#FFFFFF" },
  ink:   { bg: "#14161B", card: "#1E222A", ink: "#F4F5F7", body: "#C2C7D0", muted: "#7E8694", accent: "#F0673E", onAccent: "#FFFFFF" },
};

export type VisualThemeName = keyof typeof VISUAL_THEMES;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(t: string, maxW: number, px: number, w: keyof typeof GLYPH_W = "regular"): string[] {
  const maxChars = Math.max(4, Math.floor(maxW / (px * GLYPH_W[w])));
  const out: string[] = [];
  for (const para of t.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if ((line + " " + word).length <= maxChars) line += " " + word;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
  }
  return out;
}

function fit(t: string, maxW: number, start: number, min: number, maxLines: number, w: keyof typeof GLYPH_W = "regular") {
  const step = Math.max(1, Math.round(start * 0.04));
  for (let px = start; px >= min; px -= step) {
    const lines = wrap(t, maxW, px, w);
    if (lines.length <= maxLines) return { px, lines };
  }
  return { px: min, lines: wrap(t, maxW, min, w).slice(0, maxLines) };
}

function T(s: string, x: number, y: number, px: number, o: { fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; tracking?: number } = {}): string {
  const { fill = "#1C1917", weight = 400, anchor = "start", tracking = 0 } = o;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${px}" font-weight="${weight}"${tracking ? ` letter-spacing="${tracking}"` : ""} fill="${fill}">${esc(s)}</text>`;
}

const HERO = new Set<SlideTemplate>(["title", "divider", "quote"]);

/**
 * Turn a slide's art brief into an image prompt.
 *
 * The generator's `designDirection` is written for a human designer ("navy
 * background, gold accent bar, 36px title"), so the layout instructions are
 * stripped out — this renderer owns the layout. What survives is subject and
 * mood, plus a hard no-text rule, because generated lettering is the single
 * fastest way to make a deck look machine-made.
 */
function promptFor(slide: KoyopoSlide, designDirection: string | undefined, topic: string): string {
  const brief = (designDirection ?? "")
    .replace(/\b\d+px\b/g, "")
    .replace(/#[0-9A-Fa-f]{3,8}/g, "")
    .replace(/\b(font|typography|title|subtitle|heading|body text|left-aligned|right-aligned|watermark|corner)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // The slide title is deliberately NOT quoted. Naming it makes image models
  // letter it onto the artwork — the first run produced a calendar with "The
  // close was never the bottlerek. eck" hand-written across it. The art brief
  // carries the subject instead, and the topic is the fallback context.
  return [
    "TEXT-FREE IMAGE. Do not render any words, letters, numbers, captions, labels, logos, watermarks or user-interface chrome anywhere in this image.",
    "If the subject would normally carry writing — a page, a screen, a sign, a calendar, a book — show it blank, or with abstract marks that are clearly not letters.",
    brief ? `Subject and art direction: ${brief}.` : `Subject: a visual metaphor for ${topic}.`,
    topic && brief ? `Wider context: ${topic}.` : "",
    "Rich, human-made feel — a real photograph, a hand-drawn illustration, a character, or a textured graphic pattern, whichever suits the subject.",
    "One strong focal subject, generous negative space, muted professional palette.",
    "Do not draw readable numerals either — a calendar, clock or chart should show blank cells or abstract marks.",
    "Remember: absolutely no text of any kind.",
  ].filter(Boolean).join(" ");
}

export interface VisualOptions {
  seed?: string;
  theme?: VisualThemeName;
  author?: string;
  topic?: string;
  /** Public paths (/uploads/...) of images the client supplied. */
  referenceImages?: string[];
  /** Per-slide art briefs, index-aligned with the slides. */
  designDirections?: (string | undefined)[];
  geminiKey?: string;
  /**
   * Generate art for slides with no uploaded image. Off by default: a 10-slide
   * deck is 10 image calls, which is minutes of wall clock and real quota, and
   * that has to be an explicit choice.
   */
  generateArt?: boolean;
  badgeNumber?: number;
  pageTotal?: number;
}

function roundRect(x: number, y: number, w: number, h: number, r: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
}

/** Read an uploaded image off disk. Missing files are skipped, never fatal. */
async function loadUpload(publicPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
  } catch {
    return null;
  }
}

export async function renderVisualDeck(
  slides: KoyopoSlide[],
  opts: VisualOptions = {}
): Promise<Buffer[]> {
  const { width: W, height: H } = VISUAL_CANVAS;
  const K = VISUAL_THEMES[opts.theme ?? "paper"] ?? VISUAL_THEMES.paper;
  const uploads = opts.referenceImages ?? [];

  const out: Buffer[] = [];
  let badge = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const isHero = HERO.has(slide.template);
    if (!isHero) badge++;

    // ── Pick this slide's picture ──
    // With AI art ON the model draws every slide. Uploads used to win outright,
    // which meant a client who had uploaded anything never saw generated art at
    // all — the toggle looked broken. Uploads are the fallback now.
    let art: Buffer | null = null;
    if (opts.generateArt) {
      try {
        // Generate AT the art band's own ratio. A square image cover-cropped
        // into a wide band loses the top and bottom of its subject — the first
        // run cut the head off the illustration.
        const img = await generateBackground(
          promptFor(slide, opts.designDirections?.[i], opts.topic ?? ""),
          { width: 1080, height: Math.round(H * 0.52), geminiKey: opts.geminiKey }
        );
        art = img.buffer;
      } catch {
        // One failed image must not cost the whole deck.
        art = null;
      }
    }
    if (!art && uploads.length) art = await loadUpload(uploads[i % uploads.length]);

    const pad = 84;
    const boxW = W - pad * 2;
    // With a picture the copy gets the lower third; without one it gets the
    // whole frame, so a missing image reads as a design choice.
    const artH = art ? Math.round(H * 0.52) : 0;
    const parts: string[] = [];

    let y = artH ? artH + 70 : Math.round(H * 0.3);

    if (!isHero) {
      const chip = 62;
      parts.push(roundRect(pad, y - 44, chip, chip, 18, K.accent));
      parts.push(T(String(badge), pad + chip / 2, y - 44 + chip * 0.68, 30, { fill: K.onAccent, weight: 800, anchor: "middle" }));
      const tx = pad + chip + 22;
      const head = fit(slide.title ?? "", W - tx - pad, 50, 30, 2, "bold");
      let hy = y - 44 + (head.lines.length === 1 ? 42 : 26);
      head.lines.forEach((ln) => {
        parts.push(T(ln, tx, hy, head.px, { fill: K.ink, weight: 700, tracking: -head.px * 0.015 }));
        hy += Math.round(head.px * 1.16);
      });
      y = Math.max(hy + 22, y + chip - 20);
    } else {
      const head = fit(slide.title ?? "", boxW, 74, 36, 3, "bold");
      head.lines.forEach((ln) => {
        parts.push(T(ln, pad, y, head.px, { fill: K.ink, weight: 800, tracking: -head.px * 0.022 }));
        y += Math.round(head.px * 1.12);
      });
      parts.push(roundRect(pad, y + 12, 70, 8, 4, K.accent));
      y += 56;
    }

    // Body: the slide's items as short paragraphs, trimmed to what fits under
    // the picture rather than shrunk to an unreadable size.
    const paras = slide.items?.length
      ? slide.items.slice(0, 3)
      : (slide.body ?? slide.subtitle ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3);

    const footTop = H - 150;

    // Measure the takeaway card before laying out the body — otherwise the last
    // paragraph runs underneath it, which is exactly what the first render did.
    const takeaway = slide.subtitle?.trim();
    const tk = takeaway && !isHero ? fit(takeaway, boxW - 56, 24, 18, 2, "bold") : null;
    const takeH = tk ? 52 + tk.lines.length * Math.round(tk.px * 1.32) : 0;
    const bodyLimit = footTop - (takeH ? takeH + 24 : 0);

    let bodyPx = 26;
    let lines: string[][] = [];
    for (;;) {
      lines = paras.map((p) => wrap(p, boxW, bodyPx));
      const h = lines.reduce((a, l, idx) => a + l.length * Math.round(bodyPx * 1.45) + (idx ? 20 : 0), 0);
      if (y + h <= bodyLimit || bodyPx <= 19) break;
      bodyPx -= 1;
    }
    for (let pi = 0; pi < lines.length; pi++) {
      const para = lines[pi];
      const paraH = para.length * Math.round(bodyPx * 1.45) + (pi ? 20 : 0);
      // At the floor size a long slide can still overflow; stop cleanly rather
      // than printing over the takeaway.
      if (y + paraH > bodyLimit) break;
      if (pi) y += 20;
      para.forEach((ln) => {
        parts.push(T(ln, pad, y, bodyPx, { fill: K.body }));
        y += Math.round(bodyPx * 1.45);
      });
    }

    // Takeaway pinned above the footer, where the eye lands last.
    if (tk) {
      const top = footTop - takeH;
      parts.push(roundRect(pad, top, boxW, takeH, 20, K.card));
      let ty = top + 34;
      tk.lines.forEach((ln) => {
        parts.push(T(ln, pad + 28, ty, tk.px, { fill: K.ink, weight: 700 }));
        ty += Math.round(tk.px * 1.32);
      });
    }

    if (opts.author) parts.push(T(opts.author, W - pad, H - 60, 20, { fill: K.muted, anchor: "end" }));
    if (opts.pageTotal) parts.push(T(`${i + 1} / ${opts.pageTotal}`, pad, H - 60, 20, { fill: K.muted }));

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${K.bg}"/>
  ${parts.join("\n  ")}
</svg>`;

    let composed = sharp(Buffer.from(svg));
    if (art) {
      // Cover-crop to the art band so any aspect ratio lands cleanly, then place
      // it flush to the top edge — a full-bleed picture reads far stronger in a
      // feed thumbnail than one floating inside a margin.
      const cropped = await sharp(art).resize(W, artH, { fit: "cover", position: "attention" }).png().toBuffer();
      composed = sharp(await composed.png().toBuffer()).composite([{ input: cropped, left: 0, top: 0 }]);
    }
    out.push(await composed.png().toBuffer());
  }

  return out;
}
