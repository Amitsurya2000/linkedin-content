import sharp from "sharp";
import type { KoyopoSlide, SlideTemplate } from "./koyopo";

/**
 * "Attention" deck renderer — the fourth and most expressive style.
 *
 * Built from patterns catalogued across published carousels (Buffer's example
 * roundup, Will McTighe's rule decks, alpha.one's attention guide). Where the
 * swipe renderer is deliberately austere, this one adds the devices that make a
 * deck stop a scroll:
 *
 *   • a highlight chip burning one phrase of the title into an accent block
 *   • Q&A slides, quote cards and a real bar-chart infographic
 *   • an outro slide with a hand-drawn dotted arrow, a follow call-to-action,
 *     an optional cut-out photo and a button chip
 *
 * Separate file on purpose. koyopo.ts is a locked brand system and is not
 * touched by anything here; deck-swipe.ts stays the minimal style. Four
 * renderers, one slide model.
 */

export const ATTN_CANVASES = {
  tall: { width: 1080, height: 1350, scale: 1 },
  wide: { width: 1920, height: 1080, scale: 1.22 },
} as const;

export type AttnCanvas = keyof typeof ATTN_CANVASES;

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

export interface AttnTheme {
  bg: string;
  card: string;
  card2: string;
  deep: string;
  ink: string;
  body: string;
  muted: string;
  accent: string;
  /** Second accent, used only for the CTA button so it reads as an action. */
  action: string;
  onAccent: string;
  onDeep: string;
}

/**
 * Palettes stay professional — one accent plus one action colour. The action
 * colour is what the reference decks use for their newsletter button, and it is
 * the only place a second hue appears.
 */
export const ATTN_THEMES: Record<string, AttnTheme> = {
  paper:    { bg: "#F7F4EF", card: "#EFE7DA", card2: "#F3E4DC", deep: "#1C1917", ink: "#1C1917", body: "#4A443E", muted: "#94897E", accent: "#DF5638", action: "#5F7A5A", onAccent: "#FFFFFF", onDeep: "#F7F4EF" },
  slate:    { bg: "#F5F7F9", card: "#E7EDF3", card2: "#E2EAF6", deep: "#0F1D2E", ink: "#0F1D2E", body: "#3E4C5C", muted: "#8497A9", accent: "#1D4ED8", action: "#0F766E", onAccent: "#FFFFFF", onDeep: "#F5F7F9" },
  sage:     { bg: "#F4F6F2", card: "#E6EDE3", card2: "#E3EDE7", deep: "#16241C", ink: "#16241C", body: "#414D45", muted: "#879186", accent: "#2F7A5B", action: "#B45309", onAccent: "#FFFFFF", onDeep: "#F4F6F2" },
  ember:    { bg: "#F6F5F3", card: "#EBE8E3", card2: "#F1E7D9", deep: "#1A1815", ink: "#1A1815", body: "#474038", muted: "#8E867B", accent: "#B45309", action: "#3F6B54", onAccent: "#FFFFFF", onDeep: "#F6F5F3" },
  midnight: { bg: "#12141A", card: "#1C2029", card2: "#232834", deep: "#0A0C10", ink: "#F4F5F7", body: "#C2C7D0", muted: "#7E8694", accent: "#F0673E", action: "#3FA07A", onAccent: "#FFFFFF", onDeep: "#F4F5F7" },
};

export type AttnThemeName = keyof typeof ATTN_THEMES;

export function pickAttnTheme(seed: string): { name: AttnThemeName; theme: AttnTheme } {
  const names = Object.keys(ATTN_THEMES) as AttnThemeName[];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const name = names[h % names.length];
  return { name, theme: ATTN_THEMES[name] };
}

// ── text helpers (each renderer carries its own, as in koyopo.ts) ────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function textW(s: string, px: number, w: keyof typeof GLYPH_W = "regular"): number {
  return s.length * px * GLYPH_W[w];
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

function roundRect(x: number, y: number, w: number, h: number, r: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
}

// ── highlight chip ───────────────────────────────────────────────────────────

/**
 * Titles may mark ONE phrase for emphasis with *asterisks*: "Repost and Follow
 * *Will McTighe* for more content". That phrase renders inside a filled accent
 * block, which is the single loudest device in this style — so it is limited to
 * one phrase and never applied automatically.
 */
function parseHighlight(title: string): { plain: string; phrase: string | null } {
  const m = /\*([^*]{1,40})\*/.exec(title);
  if (!m) return { plain: title, phrase: null };
  return { plain: title.replace(/\*/g, ""), phrase: m[1] };
}

interface TitleLine { text: string; hl: boolean }

/**
 * Lay a title out with the highlighted phrase on ITS OWN LINE.
 *
 * The alternative — highlighting mid-line — needs the accent block positioned
 * from estimated advance widths while the SVG engine positions the glyphs from
 * real ones. The two drift, and at 60px the block visibly detaches from its
 * words. Giving the phrase its own line means the block only ever starts at the
 * text origin, where estimate and reality agree. It is also what the reference
 * decks do: "Repost and Follow" / "**Will McTighe**" / "for more content".
 */
function layoutTitle(title: string, maxW: number, px: number): TitleLine[] {
  const { plain, phrase } = parseHighlight(title);
  if (!phrase) return wrap(plain, maxW, px, "bold").map((text) => ({ text, hl: false }));

  const i = plain.indexOf(phrase);
  const before = plain.slice(0, i).trim();
  const after = plain.slice(i + phrase.length).trim();
  const out: TitleLine[] = [];
  if (before) out.push(...wrap(before, maxW, px, "bold").map((text) => ({ text, hl: false })));
  out.push(...wrap(phrase, maxW, px, "bold").map((text) => ({ text, hl: true })));
  if (after) out.push(...wrap(after, maxW, px, "bold").map((text) => ({ text, hl: false })));
  return out;
}

/** Shrink until the laid-out title fits the line budget. */
function fitTitle(title: string, maxW: number, start: number, min: number, maxLines: number) {
  const step = Math.max(1, Math.round(start * 0.04));
  for (let px = start; px >= min; px -= step) {
    const lines = layoutTitle(title, maxW, px);
    if (lines.length <= maxLines) return { px, lines };
  }
  return { px: min, lines: layoutTitle(title, maxW, min).slice(0, maxLines) };
}

function drawTitle(
  lines: TitleLine[], x: number, y: number, px: number, lh: number,
  K: AttnTheme, onDark: boolean, weight = 700
): { svg: string[]; endY: number } {
  const out: string[] = [];
  let ty = y;
  for (const ln of lines) {
    if (ln.hl) {
      const w = textW(ln.text, px, "bold");
      out.push(roundRect(x - px * 0.16, ty - px * 0.85, w + px * 0.32, px * 1.18, px * 0.13, K.accent));
      out.push(T(ln.text, x, ty, px, { fill: K.onAccent, weight, tracking: -px * 0.015 }));
    } else {
      out.push(T(ln.text, x, ty, px, { fill: onDark ? K.onDeep : K.ink, weight, tracking: -px * 0.015 }));
    }
    ty += lh;
  }
  return { svg: out, endY: ty };
}

// ── hand-drawn dotted arrow ──────────────────────────────────────────────────

/**
 * The looping dotted arrow from the reference outro slide. Drawn as a dotted
 * bezier with a solid dot at the tail, so it reads as hand-sketched rather than
 * as a UI control.
 */
function loopArrow(x: number, y: number, w: number, h: number, color: string, sw: number): string {
  const c = `stroke="${color}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="1 ${sw * 3.2}"`;
  // Endpoint and head share one coordinate so the tip never floats away from
  // the last dot the way a separately-placed chevron does.
  const ex = x + w;
  const ey = y + h * 0.86;
  return `<g>
    <circle cx="${x}" cy="${y}" r="${sw * 1.1}" fill="${color}"/>
    <path d="M${x + sw * 3} ${y} C${x + w * 0.55} ${y - h * 0.5} ${x + w * 1.05} ${y + h * 0.15} ${x + w * 0.5} ${y + h * 0.72} C${x + w * 0.18} ${y + h * 1.05} ${x + w * 0.72} ${y + h * 1.12} ${ex} ${ey}" ${c}/>
    <path d="M${ex - sw * 4.6} ${ey - sw * 3.4} L${ex} ${ey} L${ex - sw * 5.4} ${ey + sw * 1.6} Z" fill="${color}" stroke="${color}" stroke-width="${sw * 0.6}" stroke-linejoin="round"/>
  </g>`;
}

// ── slide data helpers ───────────────────────────────────────────────────────

const HERO = new Set<SlideTemplate>(["title", "divider", "quote"]);

/** "Label — 42%" / "Label: 42" → a bar. Anything unparsable is skipped. */
function parseBars(items: string[]): { label: string; value: number; raw: string }[] {
  const out: { label: string; value: number; raw: string }[] = [];
  for (const it of items) {
    const m = /^(.{1,44}?)\s*[—:–-]\s*([\d.]+)\s*(%|x|k|m|hrs?|min)?\b/i.exec(it.trim());
    if (!m) continue;
    const v = parseFloat(m[2]);
    if (!isFinite(v)) continue;
    out.push({ label: m[1].trim(), value: v, raw: `${m[2]}${m[3] ?? ""}` });
  }
  return out;
}

function paragraphsFor(s: KoyopoSlide, dropLast: boolean): string[] {
  const paras = s.items?.length
    ? s.items.slice(0, 5)
    : s.body
      ? s.body.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 5)
      : [];
  return dropLast ? paras.slice(0, -1) : paras.slice(0, 4);
}

function borrowsTakeaway(s: KoyopoSlide): boolean {
  return !s.subtitle?.trim() && (s.items?.length ?? 0) >= 3;
}

function takeawayFor(s: KoyopoSlide): string | undefined {
  const explicit = s.subtitle?.trim();
  if (explicit) return explicit;
  if (borrowsTakeaway(s)) return s.items![Math.min(s.items!.length, 5) - 1];
  return undefined;
}

// ── options ──────────────────────────────────────────────────────────────────

export interface AttnOptions {
  canvas?: AttnCanvas;
  seed?: string;
  theme?: AttnThemeName;
  author?: string;
  pageNumber?: number;
  pageTotal?: number;
  badgeNumber?: number;
  /** Outro slide copy. */
  cta?: { line?: string; button?: string };
  /**
   * Absolute path or public-relative path to a headshot for the outro slide.
   * A background-removed PNG matches the reference exactly; any photo works —
   * it gets masked into a circle rather than left as a hard rectangle.
   */
  photoPath?: string;
}

// ── renderer ─────────────────────────────────────────────────────────────────

export async function renderAttnSlide(slide: KoyopoSlide, opts: AttnOptions = {}): Promise<Buffer> {
  const canvas = opts.canvas ?? "tall";
  const { width: W, height: H, scale } = ATTN_CANVASES[canvas];
  const u = (n: number) => Math.round(n * scale);
  const K = opts.theme ? ATTN_THEMES[opts.theme] : pickAttnTheme(opts.seed ?? "default").theme;

  const pad = u(84);
  const boxW = W - pad * 2;
  const parts: string[] = [];
  const isHero = HERO.has(slide.template);
  const isOutro = slide.template === "divider";

  if (isOutro) {
    parts.push(...outroSlide(slide, { W, H, pad, boxW, u, K, opts }));
  } else if (isHero) {
    parts.push(...heroSlide(slide, { W, H, pad, boxW, u, K, opts }));
  } else {
    const chip = u(88);
    const chipTop = u(150) - chip * 0.72;
    parts.push(roundRect(pad, chipTop, chip, chip, u(24), K.accent));
    parts.push(T(`${opts.badgeNumber ?? opts.pageNumber ?? 1}.`, pad + chip / 2, chipTop + chip * 0.66, u(42), { fill: K.onAccent, weight: 800, anchor: "middle" }));

    const tx = pad + chip + u(28);
    const head = fitTitle(slide.title ?? "", W - tx - pad, u(60), u(38), 3);
    const lh = Math.round(head.px * 1.2);
    const drawn = drawTitle(head.lines, tx, chipTop + u(head.lines.length === 1 ? 58 : 42), head.px, lh, K, false);
    parts.push(...drawn.svg);

    const y = Math.max(drawn.endY + u(20), chipTop + chip + u(44));
    parts.push(...contentSlide(slide, { W, H, pad, boxW, u, K, y, footTop: H - u(120) }));
  }

  // Footer signature. The outro carries its own; the cover already says
  // "SWIPE →" in that exact spot, so it must not also get the dashed arrow.
  if (!isOutro) {
    const fy = H - u(70);
    if (slide.template !== "title") {
      parts.push(dashedArrow(pad, fy - u(6), u(74), isHero ? "rgba(255,255,255,0.55)" : K.muted, u));
    }
    if (opts.author) parts.push(T(opts.author, W - pad, fy, u(21), { fill: isHero ? "rgba(255,255,255,0.7)" : K.muted, anchor: "end" }));
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${isHero && !isOutro ? K.deep : K.bg}"/>
  ${parts.join("\n  ")}
</svg>`;

  let img = sharp(Buffer.from(svg));

  // The outro photo is composited after rasterising — sharp cannot mask an
  // external bitmap from inside the SVG string.
  if (isOutro && opts.photoPath) {
    const size = Math.round(W * 0.34);
    try {
      const circle = Buffer.from(
        `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
      );
      const photo = await sharp(opts.photoPath)
        .resize(size, size, { fit: "cover", position: "top" })
        .composite([{ input: circle, blend: "dest-in" }])
        .png()
        .toBuffer();
      img = sharp(
        await img.png().toBuffer()
      ).composite([{ input: photo, left: W - pad - size, top: Math.round(H * 0.44) }]);
    } catch {
      // A missing or unreadable photo must never fail the whole deck.
    }
  }

  return img.png().toBuffer();
}

function dashedArrow(x: number, y: number, w: number, color: string, u: (n: number) => number): string {
  const sw = Math.max(2, u(3));
  return `<g stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round">
    <path d="M${x} ${y} L${x + w} ${y}" stroke-dasharray="${u(7)} ${u(9)}"/>
    <path d="M${x + w - u(9)} ${y - u(7)} L${x + w + u(2)} ${y} L${x + w - u(9)} ${y + u(7)}" stroke-linejoin="round"/>
  </g>`;
}

type Ctx = { W: number; H: number; pad: number; boxW: number; u: (n: number) => number; K: AttnTheme };

/** Cover / quote — full-bleed ink ground. */
function heroSlide(s: KoyopoSlide, ctx: Ctx & { opts: AttnOptions }): string[] {
  const { W, H, pad, boxW, u, K, opts } = ctx;
  const out: string[] = [];
  out.push(`<circle cx="${W * 1.02}" cy="${H * -0.02}" r="${W * 0.42}" fill="${K.accent}" opacity="0.16"/>`);

  if (s.template === "quote") {
    const q = fit(s.body ?? s.title ?? "", boxW, u(58), u(30), 7, "bold");
    let y = Math.round(H * 0.42) - ((q.lines.length - 1) * Math.round(q.px * 1.22)) / 2;
    out.push(`<rect x="${pad}" y="${y - u(74)}" width="${u(64)}" height="${u(7)}" rx="${u(4)}" fill="${K.accent}"/>`);
    q.lines.forEach((ln) => { out.push(T(ln, pad, y, q.px, { fill: K.onDeep, weight: 700, tracking: -q.px * 0.015 })); y += Math.round(q.px * 1.22); });
    if (s.subtitle) out.push(T(s.subtitle, pad, y + u(28), u(24), { fill: K.accent, weight: 600 }));
    return out;
  }

  if (opts.pageTotal) {
    const label = `${opts.pageTotal} SLIDES`;
    const pw = textW(label, u(15), "bold") + u(34);
    out.push(roundRect(pad, u(120), pw, u(44), u(22), "rgba(255,255,255,0.12)"));
    out.push(T(label, pad + pw / 2, u(150), u(15), { fill: "rgba(255,255,255,0.75)", weight: 600, anchor: "middle", tracking: u(15) * 0.14 }));
  }

  // Cover titles support the highlight chip too — on a dark ground the accent
  // block is what the eye lands on first in the feed.
  const t = fitTitle(s.title ?? "", boxW, u(94), u(40), 5);
  const lh = Math.round(t.px * 1.14);
  const startY = Math.round(H * 0.46) - Math.round(((t.lines.length - 1) * lh) / 2);
  const drawn = drawTitle(t.lines, pad, startY, t.px, lh, K, true, 800);
  out.push(...drawn.svg);
  const y = drawn.endY;

  if (!t.lines.some((l) => l.hl)) {
    out.push(`<rect x="${pad}" y="${y - lh + u(28)}" width="${u(72)}" height="${u(8)}" rx="${u(4)}" fill="${K.accent}"/>`);
  }

  if (s.subtitle) {
    const sub = fit(s.subtitle, boxW, u(28), u(18), 3);
    let sy = y + u(30);
    sub.lines.forEach((ln) => { out.push(T(ln, pad, sy, sub.px, { fill: "rgba(255,255,255,0.78)" })); sy += Math.round(sub.px * 1.4); });
  }
  out.push(T("SWIPE →", pad, H - u(70), u(20), { fill: K.accent, weight: 700, tracking: u(20) * 0.14 }));
  return out;
}

/**
 * Outro — the follow/CTA slide. Paper ground (not dark) so it reads as part of
 * the deck rather than a second cover, with the loop arrow pointing from the
 * call-to-action toward the photo.
 */
function outroSlide(s: KoyopoSlide, ctx: Ctx & { opts: AttnOptions }): string[] {
  const { W, H, pad, u, K, opts } = ctx;
  const out: string[] = [];
  const author = opts.author ?? "";
  const line = opts.cta?.line ?? (author ? `Repost and Follow *${author}* for more content like this` : (s.title ?? "Follow for more"));

  const hasPhoto = !!opts.photoPath;
  // Title block — narrow when a photo shares the slide, so the two never collide.
  const tw = Math.round(W * (hasPhoto ? 0.6 : 0.82));
  const head = fitTitle(line, tw, u(66), u(38), 5);
  const lh = Math.round(head.px * 1.22);
  const drawn = drawTitle(head.lines, pad, u(200), head.px, lh, K, false, 800);
  out.push(...drawn.svg);

  // Loop arrow, pointing at the photo when there is one and at the CTA when
  // there is not — an arrow aimed at empty space is worse than no arrow.
  const arrowW = Math.round(W * (hasPhoto ? 0.22 : 0.17));
  out.push(loopArrow(
    pad + Math.round(tw * (hasPhoto ? 0.66 : 0.1)),
    drawn.endY + u(30),
    arrowW,
    Math.round(H * 0.1),
    K.ink,
    Math.max(3, u(5))
  ));

  // Supporting question + action button. Anchored under the arrow without a
  // photo, low-left with one, so the composition never leaves a dead band.
  const q = s.subtitle ?? s.body ?? "Want more like this?";
  const qf = fit(q, Math.round(W * (hasPhoto ? 0.5 : 0.66)), u(27), u(19), 3, "bold");
  // Anchored low either way. Placing it directly under the arrow left a third
  // of the slide empty below the button, which reads as an unfinished frame.
  let y = Math.round(H * (hasPhoto ? 0.66 : 0.63));
  qf.lines.forEach((ln) => { out.push(T(ln, pad, y, qf.px, { fill: K.ink, weight: 700 })); y += Math.round(qf.px * 1.3); });

  const btn = opts.cta?.button ?? "Follow for the next one";
  const bf = fit(btn, Math.round(W * 0.52), u(24), u(16), 1, "bold");
  const bw = textW(bf.lines[0] ?? btn, bf.px, "bold") + u(44);
  const bh = Math.round(bf.px * 2.2);
  out.push(roundRect(pad, y + u(14), bw, bh, u(10), K.action));
  out.push(T(bf.lines[0] ?? btn, pad + bw / 2, y + u(14) + bh * 0.66, bf.px, { fill: K.onAccent, weight: 700, anchor: "middle" }));

  if (author) out.push(T(author, pad, H - u(64), u(21), { fill: K.muted }));
  return out;
}

function contentSlide(s: KoyopoSlide, ctx: Ctx & { y: number; footTop: number }): string[] {
  const { pad, boxW, u, K, footTop } = ctx;
  const out: string[] = [];
  const y0 = ctx.y;
  const innerPad = u(42);
  const innerW = boxW - innerPad * 2;

  const takeaway = takeawayFor(s);
  let takeH = 0;
  let take: { px: number; lines: string[] } | null = null;
  if (takeaway) {
    take = fit(takeaway, innerW, u(28), u(20), 3, "bold");
    takeH = u(34) * 2 + take.lines.length * Math.round(take.px * 1.34);
  }
  const gap = u(24);
  const availH = footTop - y0 - (takeH ? takeH + gap : 0);
  const place = (h: number) => y0 + Math.round(Math.max(0, availH - h) * 0.45);
  const takeAt = (top: number, h: number) =>
    take ? takeCard(pad, top + h + gap, boxW, takeH, take, innerPad, K, u) : [];

  // ── Bar chart — the one true infographic in the set ──
  const bars = s.items ? parseBars(s.items) : [];
  if ((s.template === "bigStat" || s.template === "cardGrid" || s.template === "numbered") && bars.length >= 2) {
    const rowH = u(78);
    const h = Math.min(availH, u(52) * 2 + bars.length * rowH);
    const top = place(h);
    out.push(roundRect(pad, top, boxW, h, u(34), K.card));
    const max = Math.max(...bars.map((b) => b.value));
    const barX = pad + innerPad;
    const barW = innerW;
    let by = top + u(58);
    bars.forEach((b, i) => {
      out.push(T(b.label, barX, by, u(22), { fill: K.body, weight: 600 }));
      out.push(T(b.raw, barX + barW, by, u(22), { fill: K.accent, weight: 800, anchor: "end" }));
      const trackY = by + u(12);
      const th = u(16);
      out.push(roundRect(barX, trackY, barW, th, th / 2, K.bg));
      const w = Math.max(th, Math.round((b.value / max) * barW));
      out.push(roundRect(barX, trackY, w, th, th / 2, i === 0 ? K.accent : K.muted));
      by += rowH;
    });
    out.push(...takeAt(top, h));
    return out;
  }

  // ── Q&A ──
  if (s.template === "worksheet" || s.template === "templateCard") {
    const rows = (s.items?.length ? s.items : (s.body ?? "").split("\n").filter(Boolean)).slice(0, 3);
    const measured = rows.map((r) => {
      const [q, a] = splitQA(r);
      return {
        q: fit(q, innerW, u(27), u(19), 2, "bold"),
        a: fit(a, innerW, u(25), u(18), 4),
      };
    });
    const h = Math.min(
      availH,
      measured.reduce((acc, m) => acc + u(34) + m.q.lines.length * Math.round(m.q.px * 1.26) + u(10) + m.a.lines.length * Math.round(m.a.px * 1.42) + u(24), u(40))
    );
    const top = place(h);
    out.push(roundRect(pad, top, boxW, h, u(34), K.card));
    let ty = top + u(58);
    measured.forEach((m, i) => {
      if (i) {
        out.push(`<rect x="${pad + innerPad}" y="${ty - u(26)}" width="${innerW}" height="1" fill="${K.muted}" opacity="0.3"/>`);
      }
      out.push(roundRect(pad + innerPad, ty - u(20), u(26), u(26), u(8), K.accent));
      out.push(T("Q", pad + innerPad + u(13), ty, u(17), { fill: K.onAccent, weight: 800, anchor: "middle" }));
      m.q.lines.forEach((ln, li) => {
        out.push(T(ln, pad + innerPad + u(40), ty + li * Math.round(m.q.px * 1.26), m.q.px, { fill: K.ink, weight: 700 }));
      });
      ty += m.q.lines.length * Math.round(m.q.px * 1.26) + u(16);
      m.a.lines.forEach((ln) => {
        out.push(T(ln, pad + innerPad + u(40), ty, m.a.px, { fill: K.body }));
        ty += Math.round(m.a.px * 1.42);
      });
      ty += u(34);
    });
    out.push(...takeAt(top, h));
    return out;
  }

  // ── Big stat ──
  if (s.template === "bigStat" && s.stat) {
    const h = Math.min(availH, u(400));
    const top = place(h);
    out.push(roundRect(pad, top, boxW, h, u(34), K.card));
    const st = fit(s.stat, innerW, u(150), u(60), 1, "bold");
    out.push(T(st.lines[0] ?? s.stat, pad + boxW / 2, top + h * 0.52, st.px, { fill: K.accent, weight: 800, anchor: "middle", tracking: -st.px * 0.03 }));
    if (s.statLabel) out.push(T(s.statLabel.toUpperCase().slice(0, 40), pad + boxW / 2, top + h * 0.52 + u(56), u(20), { fill: K.body, weight: 600, anchor: "middle", tracking: u(20) * 0.1 }));
    out.push(...takeAt(top, h));
    return out;
  }

  // ── Two column ──
  if (s.template === "twoColumn" && s.columns?.length) {
    const cols = s.columns.slice(0, 2);
    const cgap = u(22);
    const cw = Math.floor((boxW - cgap) / 2);
    const measure = (col: { heading: string; items: string[] }) => {
      const head = fit(col.heading.toUpperCase().slice(0, 24), cw - u(48), u(19), u(14), 2, "bold");
      const body = col.items.slice(0, 5).reduce((acc, it) => {
        const b = fit(it, cw - u(56), u(24), u(17), 4);
        return acc + b.lines.length * Math.round(b.px * 1.38) + u(14);
      }, 0);
      return u(52) + head.lines.length * Math.round(head.px * 1.3) + u(14) + body + u(26);
    };
    const h = Math.min(availH, Math.max(...cols.map(measure)));
    const top = place(h);
    cols.forEach((col, ci) => {
      const x = pad + ci * (cw + cgap);
      out.push(roundRect(x, top, cw, h, u(30), ci === 1 ? K.card2 : K.card));
      const head = fit(col.heading.toUpperCase().slice(0, 24), cw - u(48), u(19), u(14), 2, "bold");
      let ty = top + u(52);
      head.lines.forEach((ln) => {
        out.push(T(ln, x + u(28), ty, head.px, { fill: ci === 1 ? K.accent : K.muted, weight: 700, tracking: head.px * 0.1 }));
        ty += Math.round(head.px * 1.3);
      });
      ty += u(14);
      col.items.slice(0, 5).forEach((it) => {
        const b = fit(it, cw - u(56), u(24), u(17), 4);
        b.lines.forEach((ln, li) => {
          if (li === 0) out.push(`<circle cx="${x + u(32)}" cy="${ty - u(8)}" r="${u(5)}" fill="${ci === 1 ? K.accent : K.muted}"/>`);
          out.push(T(ln, x + u(50), ty, b.px, { fill: K.body }));
          ty += Math.round(b.px * 1.38);
        });
        ty += u(14);
      });
    });
    out.push(...takeAt(top, h));
    return out;
  }

  // ── Default: paragraph card ──
  const paras = paragraphsFor(s, borrowsTakeaway(s));
  if (!paras.length && !take) return out;

  const paraGap = u(26);
  let px = u(29);
  const minPx = u(21);
  let list = paras;
  let measured: string[][] = [];
  let bodyH = 0;
  for (;;) {
    measured = list.map((p) => wrap(p, innerW, px));
    bodyH = innerPad * 2 + measured.reduce((h, l, i) => h + l.length * Math.round(px * 1.46) + (i ? paraGap : 0), 0);
    if (bodyH <= availH) break;
    if (px > minPx) { px -= 1; continue; }
    if (list.length > 1) { list = list.slice(0, -1); px = u(29); continue; }
    break;
  }
  const cardH = Math.min(availH, bodyH + u(150));
  const top = place(cardH);
  out.push(roundRect(pad, top, boxW, cardH, u(34), K.card));
  let ty = top + innerPad + Math.round(Math.max(0, cardH - bodyH) * 0.42) + Math.round(px * 1.05);
  measured.forEach((linesOfPara, i) => {
    if (i) ty += paraGap;
    linesOfPara.forEach((ln) => { out.push(T(ln, pad + innerPad, ty, px, { fill: K.body })); ty += Math.round(px * 1.46); });
  });
  out.push(...takeAt(top, cardH));
  return out;
}

/** "Question? Answer." → the two halves. Falls back to the whole line as the Q. */
function splitQA(row: string): [string, string] {
  const i = row.indexOf("?");
  if (i !== -1 && i < row.length - 2) return [row.slice(0, i + 1).trim(), row.slice(i + 1).trim()];
  const j = row.indexOf(" — ");
  if (j !== -1) return [row.slice(0, j).trim(), row.slice(j + 3).trim()];
  return [row, ""];
}

function takeCard(
  x: number, y: number, w: number, h: number,
  take: { px: number; lines: string[] },
  innerPad: number, K: AttnTheme, u: (n: number) => number
): string[] {
  const out: string[] = [roundRect(x, y, w, h, u(28), K.card2)];
  let ty = y + u(34) + Math.round(take.px);
  take.lines.forEach((ln) => { out.push(T(ln, x + innerPad, ty, take.px, { fill: K.ink, weight: 700 })); ty += Math.round(take.px * 1.34); });
  return out;
}

/**
 * Render a whole deck. The final slide is rendered as the outro CTA, which is
 * the pattern every high-performing deck in the Buffer roundup ends on — a
 * follow/repost ask, never a bare "thanks for reading".
 */
export async function renderAttnDeck(slides: KoyopoSlide[], opts: AttnOptions = {}): Promise<Buffer[]> {
  const out: Buffer[] = [];
  let badge = 0;
  for (let i = 0; i < slides.length; i++) {
    const isLast = i === slides.length - 1;
    const slide = isLast ? { ...slides[i], template: "divider" as SlideTemplate } : slides[i];
    if (!HERO.has(slide.template)) badge++;
    out.push(await renderAttnSlide(slide, { ...opts, pageNumber: i + 1, pageTotal: slides.length, badgeNumber: badge }));
  }
  return out;
}
