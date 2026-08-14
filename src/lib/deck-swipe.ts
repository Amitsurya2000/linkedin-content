import sharp from "sharp";
import { type KoyopoSlide, type SlideTemplate, type RawSlide, toKoyopoSlides } from "./koyopo";

/**
 * "Swipe" deck renderer — the minimalist editorial style that consistently wins
 * on LinkedIn (Will McTighe's "10 Rules to 10X Your Output" is the reference).
 *
 * The whole system is: warm paper ground, one accent colour, a numbered chip,
 * a bold two-line title, ONE soft card holding short paragraphs, and ONE tinted
 * card holding the takeaway. No icons, no charts, no illustration — the design
 * carries meaning by hierarchy and spacing alone, which is why it survives being
 * viewed at thumbnail size on a phone.
 *
 * Deliberately a third renderer alongside koyopo.ts (locked brand) and
 * deck-render.ts (multi-colour illustrated). They are different products.
 */

export const SWIPE_CANVASES = {
  tall: { width: 1080, height: 1350, scale: 1 },
  wide: { width: 1920, height: 1080, scale: 1.22 },
} as const;

export type SwipeCanvas = keyof typeof SWIPE_CANVASES;

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

export interface SwipeTheme {
  /** Page ground — a warm or cool off-white, never pure #FFF. */
  bg: string;
  /** Body card fill. */
  card: string;
  /** Takeaway card fill — a half-step warmer/deeper than `card`. */
  card2: string;
  /** Full-bleed cover ground. */
  deep: string;
  ink: string;
  body: string;
  muted: string;
  accent: string;
  /** Type that sits on `deep` or on `accent`. */
  onDeep: string;
}

/**
 * Four professional palettes. Each is deliberately low-chroma except for a
 * single accent — the "professional colours" constraint means the eye should
 * land on the words, with colour used only to mark position and emphasis.
 */
export const SWIPE_THEMES: Record<string, SwipeTheme> = {
  paper: { bg: "#F7F4EF", card: "#EFE7DA", card2: "#F3E4DC", deep: "#1C1917", ink: "#1C1917", body: "#4A443E", muted: "#94897E", accent: "#DF5638", onDeep: "#F7F4EF" },
  slate: { bg: "#F5F7F9", card: "#E7EDF3", card2: "#E2EAF6", deep: "#0F1D2E", ink: "#0F1D2E", body: "#3E4C5C", muted: "#8497A9", accent: "#1D4ED8", onDeep: "#F5F7F9" },
  sage:  { bg: "#F4F6F2", card: "#E6EDE3", card2: "#E3EDE7", deep: "#16241C", ink: "#16241C", body: "#414D45", muted: "#879186", accent: "#2F7A5B", onDeep: "#F4F6F2" },
  ember: { bg: "#F6F5F3", card: "#EBE8E3", card2: "#F1E7D9", deep: "#1A1815", ink: "#1A1815", body: "#474038", muted: "#8E867B", accent: "#B45309", onDeep: "#F6F5F3" },
};

export type SwipeThemeName = keyof typeof SWIPE_THEMES;

/** Stable theme per deck, so a re-render keeps the deck's identity. */
export function pickSwipeTheme(seed: string): { name: SwipeThemeName; theme: SwipeTheme } {
  const names = Object.keys(SWIPE_THEMES) as SwipeThemeName[];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const name = names[h % names.length];
  return { name, theme: SWIPE_THEMES[name] };
}

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

/** Shrink until the block fits the width and the line budget. */
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

const HERO = new Set<SlideTemplate>(["title", "divider", "quote"]);

export interface SwipeOptions {
  canvas?: SwipeCanvas;
  seed?: string;
  theme?: SwipeThemeName;
  /** Signed bottom-right on every slide, the way creator decks are. */
  author?: string;
  deckTitle?: string;
  pageNumber?: number;
  pageTotal?: number;
  /** Number shown in the accent chip. Counts content slides, not pages. */
  badgeNumber?: number;
}

/**
 * Paragraph blocks for the body card. Items already arrive as short, standalone
 * sentences ("Concept — expansion."), which is exactly the reference's rhythm:
 * 3–4 paragraphs of 1–3 lines each, never a bullet list.
 */
function paragraphsFor(s: KoyopoSlide): string[] {
  const paras = s.items?.length
    ? s.items.slice(0, 5)
    : s.body
      ? s.body.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 5)
      : [];
  // When the takeaway had to be borrowed from the items, it must not also print
  // inside the body card.
  return borrowsTakeaway(s) ? paras.slice(0, -1) : paras.slice(0, 4);
}

/**
 * Older decks (and any generator that skips `takeaway`) have no "so what" line.
 * Rather than drop the card that makes the design skimmable, promote the last
 * item — closing items are already written as the conclusion.
 */
function borrowsTakeaway(s: KoyopoSlide): boolean {
  return !s.subtitle?.trim() && (s.items?.length ?? 0) >= 3;
}

function takeawayFor(s: KoyopoSlide): string | undefined {
  const explicit = s.subtitle?.trim();
  if (explicit) return explicit;
  if (borrowsTakeaway(s)) return s.items![Math.min(s.items!.length, 5) - 1];
  return undefined;
}

export async function renderSwipeSlide(slide: KoyopoSlide, opts: SwipeOptions = {}): Promise<Buffer> {
  const canvas = opts.canvas ?? "tall";
  const { width: W, height: H, scale } = SWIPE_CANVASES[canvas];
  const u = (n: number) => Math.round(n * scale); // design units → px
  const theme = opts.theme ? SWIPE_THEMES[opts.theme] : pickSwipeTheme(opts.seed ?? "default").theme;
  const K = theme;

  const pad = u(84);
  const boxW = W - pad * 2;
  const parts: string[] = [];
  const isHero = HERO.has(slide.template);

  if (isHero) {
    parts.push(...heroSlide(slide, { W, H, pad, boxW, u, K, opts }));
  } else {
    // ── Chip + title ──
    const chip = u(88);
    const badge = String(opts.badgeNumber ?? opts.pageNumber ?? 1);
    let y = u(150);

    parts.push(roundRect(pad, y - chip * 0.72, chip, chip, u(24), K.accent));
    parts.push(T(`${badge}.`, pad + chip / 2, y - chip * 0.72 + chip * 0.66, u(42), { fill: K.onDeep, weight: 800, anchor: "middle" }));

    const tx = pad + chip + u(28);
    const tw = W - tx - pad;
    const head = fit(slide.title ?? "", tw, u(60), u(38), 3, "bold");
    let hy = y - chip * 0.72 + u(head.lines.length === 1 ? 58 : 42);
    head.lines.forEach((ln) => {
      parts.push(T(ln, tx, hy, head.px, { fill: K.ink, weight: 700, tracking: -head.px * 0.015 }));
      hy += Math.round(head.px * 1.16);
    });

    y = Math.max(hy + u(26), y - chip * 0.72 + chip + u(44));

    // ── Cards ──
    const footTop = H - u(120);
    parts.push(...cardStack(slide, { W, H, pad, boxW, u, K, y, footTop, takeaway: takeawayFor(slide) }));
  }

  // ── Footer: swipe cue left, signature right ──
  const fy = H - u(70);
  if (!isHero || slide.template !== "title") {
    parts.push(dashedArrow(pad, fy - u(6), u(74), isHero ? "rgba(255,255,255,0.55)" : K.muted, u));
  }
  if (opts.author) {
    parts.push(T(opts.author, W - pad, fy, u(21), { fill: isHero ? "rgba(255,255,255,0.7)" : K.muted, anchor: "end" }));
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${isHero ? K.deep : K.bg}"/>
  ${parts.join("\n  ")}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** The "- - - - >" swipe cue from the reference decks. */
function dashedArrow(x: number, y: number, w: number, color: string, u: (n: number) => number): string {
  const sw = Math.max(2, u(3));
  return `<g stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round">
    <path d="M${x} ${y} L${x + w} ${y}" stroke-dasharray="${u(7)} ${u(9)}"/>
    <path d="M${x + w - u(9)} ${y - u(7)} L${x + w + u(2)} ${y} L${x + w - u(9)} ${y + u(7)}" stroke-linejoin="round"/>
  </g>`;
}

type Ctx = {
  W: number; H: number; pad: number; boxW: number;
  u: (n: number) => number; K: SwipeTheme;
};

/** Cover / divider / quote — full-bleed ink ground, type and one accent rule. */
function heroSlide(s: KoyopoSlide, ctx: Ctx & { opts: SwipeOptions }): string[] {
  const { W, H, pad, boxW, u, K, opts } = ctx;
  const out: string[] = [];

  // One soft accent block, bled off the top-right corner. The only ornament in
  // the whole system — enough to stop a scroll, not enough to be decoration.
  out.push(`<circle cx="${W * 1.02}" cy="${H * -0.02}" r="${W * 0.42}" fill="${K.accent}" opacity="0.16"/>`);

  if (s.template === "quote") {
    const q = fit(s.body ?? s.title ?? "", boxW, u(58), u(30), 7, "bold");
    let y = Math.round(H * 0.42) - ((q.lines.length - 1) * Math.round(q.px * 1.22)) / 2;
    out.push(`<rect x="${pad}" y="${y - u(74)}" width="${u(64)}" height="${u(7)}" rx="${u(4)}" fill="${K.accent}"/>`);
    q.lines.forEach((ln) => { out.push(T(ln, pad, y, q.px, { fill: K.onDeep, weight: 700, tracking: -q.px * 0.015 })); y += Math.round(q.px * 1.22); });
    if (s.subtitle) out.push(T(s.subtitle, pad, y + u(28), u(24), { fill: K.accent, weight: 600 }));
    return out;
  }

  const isCover = s.template === "title";

  if (isCover && opts.pageTotal) {
    // Small "N pages" pill — sets the expectation that this is a swipe deck.
    const label = `${opts.pageTotal} SLIDES`;
    const pw = label.length * u(13) * 0.62 + u(34);
    out.push(roundRect(pad, u(120), pw, u(44), u(22), "rgba(255,255,255,0.12)"));
    out.push(T(label, pad + pw / 2, u(150), u(15), { fill: "rgba(255,255,255,0.75)", weight: 600, anchor: "middle", tracking: u(15) * 0.14 }));
  }

  const t = fit(s.title ?? "", boxW, isCover ? u(96) : u(72), u(40), 5, "bold");
  const lh = Math.round(t.px * 1.08);
  let y = Math.round(H * (isCover ? 0.48 : 0.5)) - Math.round(((t.lines.length - 1) * lh) / 2);
  t.lines.forEach((ln) => { out.push(T(ln, pad, y, t.px, { fill: K.onDeep, weight: 800, tracking: -t.px * 0.025 })); y += lh; });

  out.push(`<rect x="${pad}" y="${y + u(14)}" width="${u(72)}" height="${u(8)}" rx="${u(4)}" fill="${K.accent}"/>`);

  if (s.subtitle) {
    const sub = fit(s.subtitle, boxW, u(28), u(18), 3);
    let sy = y + u(64);
    sub.lines.forEach((ln) => { out.push(T(ln, pad, sy, sub.px, { fill: "rgba(255,255,255,0.78)" })); sy += Math.round(sub.px * 1.4); });
  }

  if (isCover) {
    out.push(T("SWIPE →", pad, H - u(70), u(20), { fill: K.accent, weight: 700, tracking: u(20) * 0.14 }));
  }
  return out;
}

/**
 * The body card + takeaway card. Both are measured before drawing so the pair
 * always lands inside the footer line — the reference's calm comes from the
 * cards ending well above the signature, never from filling the frame.
 */
function cardStack(
  s: KoyopoSlide,
  ctx: Ctx & { y: number; footTop: number; takeaway?: string }
): string[] {
  const { pad, boxW, u, K, footTop } = ctx;
  const out: string[] = [];
  const y0 = ctx.y;
  const innerPad = u(42);
  const innerW = boxW - innerPad * 2;

  // Takeaway is measured first — it has priority for space.
  let takeH = 0;
  let take: { px: number; lines: string[] } | null = null;
  if (ctx.takeaway) {
    take = fit(ctx.takeaway, innerW, u(28), u(20), 3, "bold");
    takeH = u(34) * 2 + take.lines.length * Math.round(take.px * 1.34);
  }

  const gap = u(24);
  const availH = footTop - y0 - (takeH ? takeH + gap : 0);
  /** Centre a measured stack in the space between the heading and the footer. */
  const place = (h: number) => y0 + Math.round(Math.max(0, availH - h) * 0.45);

  if (s.template === "bigStat" && s.stat) {
    const h = Math.min(availH, u(400));
    const top = place(h);
    out.push(roundRect(pad, top, boxW, h, u(34), K.card));
    const st = fit(s.stat, innerW, u(150), u(60), 1, "bold");
    out.push(T(st.lines[0] ?? s.stat, pad + boxW / 2, top + h * 0.52, st.px, { fill: K.accent, weight: 800, anchor: "middle", tracking: -st.px * 0.03 }));
    if (s.statLabel) {
      out.push(T(s.statLabel.toUpperCase().slice(0, 40), pad + boxW / 2, top + h * 0.52 + u(56), u(20), { fill: K.body, weight: 600, anchor: "middle", tracking: u(20) * 0.1 }));
    }
    if (take) out.push(...takeCard(pad, top + h + gap, boxW, takeH, take, innerPad, K, u));
    return out;
  }

  if (s.template === "twoColumn" && s.columns?.length) {
    const cols = s.columns.slice(0, 2);
    const cgap = u(22);
    const cw = Math.floor((boxW - cgap) / 2);
    const itemsOf = (c: { items: string[] }) => c.items.slice(0, 5);

    // Both panels share the taller column's measured height. Fixing the height
    // instead left a comparison of three short bullets sitting in a half-empty
    // box, which reads as a rendering fault rather than a design.
    const measure = (col: { heading: string; items: string[] }) => {
      const head = fit(col.heading.toUpperCase().slice(0, 24), cw - u(48), u(19), u(14), 2, "bold");
      const body = itemsOf(col).reduce((acc, it) => {
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
      itemsOf(col).forEach((it) => {
        const b = fit(it, cw - u(56), u(24), u(17), 4);
        b.lines.forEach((ln, li) => {
          if (li === 0) out.push(`<circle cx="${x + u(32)}" cy="${ty - u(8)}" r="${u(5)}" fill="${ci === 1 ? K.accent : K.muted}"/>`);
          out.push(T(ln, x + u(50), ty, b.px, { fill: K.body }));
          ty += Math.round(b.px * 1.38);
        });
        ty += u(14);
      });
    });
    if (take) out.push(...takeCard(pad, top + h + gap, boxW, takeH, take, innerPad, K, u));
    return out;
  }

  // ── Default: one card of short paragraphs — the reference layout ──
  const paras = paragraphsFor(s);
  if (!paras.length && !take) return out;

  const paraGap = u(26);
  // Shrink body type only as far as the mobile-readable floor, then drop the
  // last paragraph. Unreadable type loses more completions than a shorter card.
  let px = u(29);
  let measured: string[][] = [];
  let bodyH = 0;
  const minPx = u(21);
  let list = paras;
  for (;;) {
    measured = list.map((p) => wrap(p, innerW, px));
    bodyH = innerPad * 2 + measured.reduce((h, l, i) => h + l.length * Math.round(px * 1.46) + (i ? paraGap : 0), 0);
    if (bodyH <= availH) break;
    if (px > minPx) { px -= 1; continue; }
    if (list.length > 1) { list = list.slice(0, -1); px = u(29); continue; }
    break;
  }

  // The card is allowed to breathe past its copy but never to stretch the full
  // gap — a card hugging three short paragraphs is the reference's proportion.
  // Any space left over is split above and below the stack so short slides read
  // as centred rather than as a layout that ran out of content.
  const cardH = Math.min(availH, bodyH + u(150));
  const top = place(cardH);

  out.push(roundRect(pad, top, boxW, cardH, u(34), K.card));

  // Copy sits optically centred in the card, biased a touch above centre.
  const slack = Math.max(0, cardH - bodyH);
  let ty = top + innerPad + Math.round(slack * 0.42) + Math.round(px * 1.05);
  measured.forEach((linesOfPara, i) => {
    if (i) ty += paraGap;
    linesOfPara.forEach((ln) => {
      out.push(T(ln, pad + innerPad, ty, px, { fill: K.body }));
      ty += Math.round(px * 1.46);
    });
  });

  if (take) out.push(...takeCard(pad, top + cardH + gap, boxW, takeH, take, innerPad, K, u));
  return out;
}

/** The tinted "so what" card that closes every content slide. */
function takeCard(
  x: number, y: number, w: number, h: number,
  take: { px: number; lines: string[] },
  innerPad: number, K: SwipeTheme, u: (n: number) => number
): string[] {
  const out: string[] = [roundRect(x, y, w, h, u(28), K.card2)];
  let ty = y + u(34) + Math.round(take.px * 1.0);
  take.lines.forEach((ln) => {
    out.push(T(ln, x + innerPad, ty, take.px, { fill: K.ink, weight: 700 }));
    ty += Math.round(take.px * 1.34);
  });
  return out;
}

/** Render a whole deck, numbering the content slides 1..n. */
export async function renderSwipeDeck(slides: KoyopoSlide[], opts: SwipeOptions = {}): Promise<Buffer[]> {
  const out: Buffer[] = [];
  let badge = 0;
  for (let i = 0; i < slides.length; i++) {
    if (!HERO.has(slides[i].template)) badge++;
    out.push(
      await renderSwipeSlide(slides[i], {
        ...opts,
        pageNumber: i + 1,
        pageTotal: slides.length,
        badgeNumber: badge,
      })
    );
  }
  return out;
}

export { toKoyopoSlides, type RawSlide, type KoyopoSlide };
