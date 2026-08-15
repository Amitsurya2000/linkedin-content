import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { generateBackground } from "./image-engine";
import type { KoyopoSlide, SlideTemplate } from "./koyopo";
import { LAB_STYLES, FACE, GLYPH_W, type FaceKind, type StyleSpec, type LabStyleName } from "./deck-lab-styles";

export { LAB_STYLES, type StyleSpec, type LabStyleName };

/**
 * Spec-driven deck styles.
 *
 * The first six renderers in this project are each a hand-written file, which is
 * right for a style with genuinely unusual mechanics (the swipe deck's takeaway
 * card, the campaign deck's skewed tabs) and wasteful for everything else. Most
 * of the looks circulating on LinkedIn differ only in ground, type treatment,
 * ornament and alignment — the same skeleton wearing different clothes.
 *
 * So this file is one layout engine plus a table of specs. Adding a style is
 * adding a row, not a file, which is what makes a shelf of them affordable.
 *
 * Each spec is a real, identifiable look with a reason to exist, not a colour
 * permutation. If two specs would produce decks a reader could not tell apart,
 * only one belongs here.
 */

export const LAB_CANVAS = { width: 1080, height: 1350 } as const;


function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(t: string, maxW: number, px: number, face: FaceKind, w: "regular" | "bold"): string[] {
  const maxChars = Math.max(4, Math.floor(maxW / (px * GLYPH_W[face][w])));
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

function fit(t: string, maxW: number, start: number, min: number, maxLines: number, face: FaceKind, w: "regular" | "bold" = "regular") {
  const step = Math.max(1, Math.round(start * 0.04));
  for (let px = start; px >= min; px -= step) {
    const lines = wrap(t, maxW, px, face, w);
    if (lines.length <= maxLines) return { px, lines };
  }
  return { px: min, lines: wrap(t, maxW, min, face, w).slice(0, maxLines) };
}

function T(s: string, x: number, y: number, px: number, face: FaceKind, o: { fill?: string; weight?: number; anchor?: "start" | "middle"; tracking?: number } = {}): string {
  const { fill = "#000", weight = 400, anchor = "start", tracking = 0 } = o;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FACE[face]}" font-size="${px}" font-weight="${weight}"${tracking ? ` letter-spacing="${tracking}"` : ""} fill="${fill}">${esc(s)}</text>`;
}

function rect(x: number, y: number, w: number, h: number, r: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
}

/** Ground texture. Drawn as a pattern so slide count does not affect file size. */
function texture(S: StyleSpec, W: number, H: number): string {
  const c = S.textureColor ?? "rgba(0,0,0,0.06)";
  switch (S.texture) {
    case "grid":
      return `<defs><pattern id="tx" width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M54 0 L0 0 0 54" fill="none" stroke="${c}" stroke-width="1.5"/>
      </pattern></defs><rect width="${W}" height="${H}" fill="url(#tx)"/>`;
    case "dots":
      return `<defs><pattern id="tx" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="2.6" fill="${c}"/>
      </pattern></defs><rect width="${W}" height="${H}" fill="url(#tx)"/>`;
    case "rules":
      return `<defs><pattern id="tx" width="1080" height="90" patternUnits="userSpaceOnUse">
        <path d="M0 89.5 H1080" stroke="${c}" stroke-width="1"/>
      </pattern></defs><rect width="${W}" height="${H}" fill="url(#tx)"/>`;
    default:
      return "";
  }
}

const HERO = new Set<SlideTemplate>(["title", "divider", "quote"]);

export interface LabOptions {
  style: LabStyleName;
  author?: string;
  pageNumber?: number;
  pageTotal?: number;
  badgeNumber?: number;
  /** Public paths of images the client uploaded. Used first, cycled. */
  referenceImages?: string[];
  /** Per-slide art briefs from the generator, index-aligned with the slides. */
  designDirections?: (string | undefined)[];
  geminiKey?: string;
  topic?: string;
  /** Generate art for slides with no uploaded image. Off by default. */
  generateArt?: boolean;
  /** Pre-resolved picture for this slide, supplied by renderLabDeck. */
  art?: Buffer | null;
}

/** Read an uploaded image off disk. A missing file is skipped, never fatal. */
async function loadUpload(publicPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
  } catch {
    return null;
  }
}

/**
 * Same prompt discipline as the illustrated deck: the slide TITLE is never
 * quoted, because naming it makes image models letter it onto the artwork.
 */
function artPrompt(designDirection: string | undefined, topic: string): string {
  const brief = (designDirection ?? "")
    .replace(/\d+px/g, "")
    .replace(/#[0-9A-Fa-f]{3,8}/g, "")
    .replace(/(font|typography|title|subtitle|heading|body text|left-aligned|right-aligned|watermark|corner)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return [
    "TEXT-FREE IMAGE. No words, letters, numbers, captions, labels, logos, watermarks or UI chrome anywhere.",
    "If the subject would normally carry writing — a page, screen, sign or calendar — show it blank.",
    brief ? `Subject and art direction: ${brief}.` : `Subject: a visual metaphor for ${topic}.`,
    "One strong focal subject, generous negative space, muted professional palette.",
    "Remember: absolutely no text of any kind.",
  ].filter(Boolean).join(" ");
}

/** Strip the *highlight* markers the other renderers use; this engine paints flat. */
function plain(t: string): string {
  return t.replace(/\*/g, "");
}

export async function renderLabSlide(slide: KoyopoSlide, opts: LabOptions): Promise<Buffer> {
  const { width: W, height: H } = LAB_CANVAS;
  const S = LAB_STYLES[opts.style] ?? LAB_STYLES.press;
  const isHero = HERO.has(slide.template);
  const pad = 88;
  const boxW = W - pad * 2;
  const centre = S.align === "center";
  const tx = centre ? W / 2 : pad;
  const anchor: "start" | "middle" = centre ? "middle" : "start";
  const parts: string[] = [];

  const ground = isHero ? (S.deep ?? S.bg) : S.bg;
  const fit_ = S.imageFit ?? "band";
  const art = fit_ === "none" ? null : opts.art ?? null;
  const bleed = !!art && fit_ === "bleed";
  const bandH = art && fit_ === "band" ? Math.round(H * 0.42) : 0;

  // On a bleed the copy sits over the photo, so it takes the cover's palette —
  // body ink chosen for a pale card would vanish against a dark image.
  const headInk = isHero || bleed ? (S.onDeep ?? S.ink) : S.ink;
  const bodyInk = isHero || bleed ? (S.onDeep ?? S.body) : S.body;

  if (!isHero && !bleed && S.texture && S.texture !== "none") parts.push(texture(S, W, H));

  const footTop = H - 150;
  let y = bandH ? bandH + 96 : 200;

  // ── Slide marker ──
  const n = String(opts.badgeNumber ?? opts.pageNumber ?? 1);
  if (!isHero && S.marker !== "none") {
    if (S.marker === "chip" || S.marker === "square") {
      const size = 76;
      const mx = centre ? W / 2 - size / 2 : pad;
      parts.push(rect(mx, y - 62, size, size, S.marker === "chip" ? size / 2 : S.radius, S.accent));
      parts.push(T(n, mx + size / 2, y - 62 + size * 0.66, 34, S.headFace, { fill: S.bg, weight: 700, anchor: "middle" }));
      y += 36;
    } else if (S.marker === "bracket") {
      // Sits ABOVE the heading, so it needs the marker's own height cleared —
      // 22px left it colliding with the first line of the title.
      parts.push(T(`[${n}]`, tx, y - 34, 30, "mono", { fill: S.accent, weight: 700, anchor }));
      y += 34;
    } else {
      // rule: a short accent bar with the number beside it
      parts.push(rect(centre ? W / 2 - 30 : pad, y - 44, 60, 6, 0, S.accent));
      parts.push(T(n.padStart(2, "0"), centre ? W / 2 : pad + 76, y - 32, 24, S.headFace, { fill: S.muted, weight: 700, anchor }));
      y += 26;
    }
  }

  // ── Heading ──
  const rawTitle = plain(slide.title ?? "");
  const title = S.headUpper ? rawTitle.toUpperCase() : rawTitle;
  const head = fit(title, boxW, isHero ? 92 : 62, 34, isHero ? 5 : 3, S.headFace, "bold");
  const lh = Math.round(head.px * 1.16);

  if (isHero) y = Math.round(H * 0.42) - Math.round(((head.lines.length - 1) * lh) / 2);

  head.lines.forEach((ln) => {
    parts.push(T(ln, tx, y, head.px, S.headFace, {
      fill: headInk, weight: S.headWeight, anchor,
      tracking: S.headUpper ? head.px * 0.02 : -head.px * 0.015,
    }));
    y += lh;
  });

  if (S.headRule && !isHero) {
    parts.push(`<path d="M${pad} ${y + 6} H${W - pad}" stroke="${S.muted}" stroke-width="1.5" opacity="0.5"/>`);
    y += 34;
  } else {
    y += 22;
  }

  if (isHero) {
    parts.push(rect(centre ? W / 2 - 36 : pad, y + 4, 72, 8, 0, S.accent));
    const sub = slide.subtitle ?? slide.body;
    if (sub) {
      const sf = fit(plain(sub), boxW, 30, 19, 3, S.bodyFace);
      let sy = y + 60;
      sf.lines.forEach((ln) => {
        parts.push(T(ln, tx, sy, sf.px, S.bodyFace, { fill: bodyInk, anchor }));
        sy += Math.round(sf.px * 1.4);
      });
    }
  } else {
    // ── Body paragraphs, in a card when the spec has one ──
    const paras = slide.items?.length
      ? slide.items.slice(0, 4)
      : (slide.body ?? "").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 4);

    const takeaway = slide.subtitle?.trim();
    const tk = takeaway ? fit(takeaway, boxW - 80, 27, 19, 3, S.bodyFace, "bold") : null;
    const takeH = tk ? 64 + tk.lines.length * Math.round(tk.px * 1.32) : 0;
    const limit = footTop - (takeH ? takeH + 26 : 0);

    const innerPad = S.card ? 40 : 0;
    const innerW = boxW - innerPad * 2;
    let px = 28;
    let lines: string[][] = [];
    for (;;) {
      lines = paras.map((p) => wrap(plain(p), innerW, px, S.bodyFace, "regular"));
      const h = lines.reduce((a, l, i) => a + l.length * Math.round(px * 1.45) + (i ? 24 : 0), 0) + innerPad * 2;
      if (y + h <= limit || px <= 19) break;
      px -= 1;
    }

    const bodyH = lines.reduce((a, l, i) => a + l.length * Math.round(px * 1.45) + (i ? 24 : 0), 0) + innerPad * 2;
    if (S.card && !bleed) parts.push(rect(pad, y, boxW, Math.min(bodyH, limit - y), S.radius, S.card));

    let ty = y + innerPad + Math.round(px * 1.05);
    for (let i = 0; i < lines.length; i++) {
      const para = lines[i];
      const paraH = para.length * Math.round(px * 1.45) + (i ? 24 : 0);
      if (ty + paraH > limit) break;
      if (i) ty += 24;
      para.forEach((ln) => {
        parts.push(T(ln, centre ? W / 2 : pad + innerPad, ty, px, S.bodyFace, { fill: bodyInk, anchor }));
        ty += Math.round(px * 1.45);
      });
    }

    if (tk) {
      const top = footTop - takeH;
      // Swiss uses the accent as the takeaway ground; everywhere else it is a tint.
      const fill = S.card2 ?? S.accent;
      const onFill = fill === S.accent ? S.bg : S.ink;
      parts.push(rect(pad, top, boxW, takeH, S.radius, fill));
      let yy = top + 40;
      tk.lines.forEach((ln) => {
        parts.push(T(ln, centre ? W / 2 : pad + 40, yy, tk.px, S.bodyFace, { fill: onFill, weight: 700, anchor }));
        yy += Math.round(tk.px * 1.32);
      });
    }
  }

  // ── Footer ──
  const footInk = isHero ? (S.onDeep ?? S.muted) : S.muted;
  if (opts.pageNumber && opts.pageTotal) {
    parts.push(T(`${opts.pageNumber}/${opts.pageTotal}`, pad, H - 62, 20, "mono", { fill: footInk }));
  }
  if (opts.author) {
    parts.push(`<text x="${W - pad}" y="${H - 62}" text-anchor="end" font-family="${FACE[S.bodyFace]}" font-size="20" fill="${footInk}">${esc(opts.author)}</text>`);
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${art ? "" : `<rect width="${W}" height="${H}" fill="${ground}"/>`}
  ${parts.join("\n  ")}
</svg>`;

  if (!art) return sharp(Buffer.from(svg)).png().toBuffer();

  // The picture goes UNDER the type, so the SVG is composited on top of it
  // rather than the other way round. A bleed gets a scrim first — copy over an
  // un-dimmed photograph is unreadable at any type size.
  const picture = await sharp(art)
    .resize(W, bleed ? H : bandH, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const layers: sharp.OverlayOptions[] = [{ input: picture, left: 0, top: 0 }];
  if (bleed) {
    layers.push({
      input: Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${S.deep ?? "#000000"}" opacity="0.74"/></svg>`
      ),
      left: 0,
      top: 0,
    });
  }
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });

  return sharp({ create: { width: W, height: H, channels: 4, background: ground } })
    .composite(layers)
    .png()
    .toBuffer();
}

export async function renderLabDeck(slides: KoyopoSlide[], opts: LabOptions): Promise<Buffer[]> {
  const out: Buffer[] = [];
  const uploads = opts.referenceImages ?? [];
  const spec = LAB_STYLES[opts.style];
  const wantsArt = (spec?.imageFit ?? "band") !== "none";
  let badge = 0;

  for (let i = 0; i < slides.length; i++) {
    if (!HERO.has(slides[i].template)) badge++;

    // Uploads first — a real photo of the real thing beats anything generated.
    let art: Buffer | null = null;
    if (wantsArt && uploads.length) art = await loadUpload(uploads[i % uploads.length]);
    if (wantsArt && !art && opts.generateArt) {
      try {
        const img = await generateBackground(artPrompt(opts.designDirections?.[i], opts.topic ?? ""), {
          width: LAB_CANVAS.width,
          height: (spec?.imageFit ?? "band") === "bleed" ? LAB_CANVAS.height : Math.round(LAB_CANVAS.height * 0.42),
          geminiKey: opts.geminiKey,
        });
        art = img.buffer;
      } catch {
        art = null; // one failed image must not cost the deck
      }
    }

    out.push(await renderLabSlide(slides[i], {
      ...opts, art, pageNumber: i + 1, pageTotal: slides.length, badgeNumber: badge,
    }));
  }
  return out;
}
