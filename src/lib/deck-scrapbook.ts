import sharp from "sharp";
import { poppinsCss } from "./font-data";
import type { KoyopoSlide } from "./koyopo";

/**
 * "Scrapbook" - the Y2K collage deck.
 *
 * Built to the y2k_scrapbook schema: a headline with marked phrases, an optional
 * pasted quote card carrying an attributed name and job title, and sticker
 * decorations scattered around them.
 *
 * The schema names its decorations as files - cherry.png, star.png - which would
 * need an asset library this app does not have. They are drawn as SVG instead.
 * That costs nothing per render, scales to any canvas without resampling, and
 * keeps the deck renderable on an account with no image budget at all, which is
 * the property every other vector style here is built around.
 *
 * What makes this read as collage rather than as a layout:
 *   - everything is rotated a degree or two, never square to the page
 *   - the highlighter sits BEHIND the words, with rounded caps, and overshoots
 *     the text slightly the way a real marker does
 *   - the quote is a white card with a drop shadow, so it reads as pasted on
 *   - stickers sit in the margins and corners, never over a word
 */

const W = 1080;
// 1:1. The spec calls for LinkedIn's square ratio, not the 4:5 the other decks
// default to, so this renderer is fixed at 1080x1080 rather than canvas-aware.
const H = 1080;
/** The spec's 80px page padding, used as the left margin for every element. */
const PAD = 80;

const C = {
  cream: "#faf7f2",
  ink: "#141414",
  body: "#3A3733",
  muted: "#77706A",
  card: "#FFFFFF",
  line: "#E4DDD2",
  // The highlighter set - deliberately pastel so ink stays readable through it.
  mint: "#B9E8C0",
  pink: "#fce7f3",
  lemon: "#FBE7A1",
  // Sticker colours.
  cherry: "#D8384A",
  leaf: "#4E8C4A",
  blue: "#4A6FD4",
  gold: "#E8A33E",
};

// Inter first per the spec; Poppins is the face actually installed here, so it
// carries the weight when Inter is absent rather than falling to Arial.
const SANS = "Inter, Poppins, 'Segoe UI', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const GW = { sans: 0.545, sansBold: 0.575, serif: 0.5 };

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Deterministic PRNG - a re-render of the same deck places stickers identically. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function wrap(text: string, maxWidth: number, size: number, gw: number): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const per = size * gw;
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length * per > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function fit(text: string, maxWidth: number, start: number, min: number, maxLines: number, gw: number) {
  let size = start;
  let lines = wrap(text, maxWidth, size, gw);
  while (lines.length > maxLines && size > min) {
    size -= 3;
    lines = wrap(text, maxWidth, size, gw);
  }
  return { size, lines: lines.slice(0, maxLines) };
}

/**
 * Pull the *marked* phrases out of a headline.
 *
 * The copy generator is already told to mark one phrase per title with asterisks
 * - the same convention the Bold deck uses for its highlight chips - so this
 * schema's `highlights` array comes free rather than needing a new prompt field.
 */
function parseHighlights(title: string): { plain: string; marked: string[] } {
  const marked = [...String(title ?? "").matchAll(/\*([^*]+)\*/g)].map((m) => m[1].trim());
  return { plain: String(title ?? "").replace(/\*/g, ""), marked };
}

// -- stickers ---------------------------------------------------------------

function sCherry(x: number, y: number, s: number, rot: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M -6 -18 C 2 -30, 14 -28, 18 -20" fill="none" stroke="${C.leaf}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 18 -20 C 22 -26, 30 -26, 33 -21 C 28 -18, 22 -18, 18 -20 Z" fill="${C.leaf}"/>
    <circle cx="-8" cy="2" r="11" fill="${C.cherry}"/>
    <circle cx="12" cy="6" r="9" fill="${C.cherry}" opacity="0.92"/>
    <circle cx="-11" cy="-2" r="3" fill="#FFFFFF" opacity="0.55"/>
  </g>`;
}

function sStar(x: number, y: number, s: number, rot: number, fill = C.gold): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 16 : 6.6;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
  }
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><polygon points="${pts.join(" ")}" fill="${fill}"/></g>`;
}

function sSparkle(x: number, y: number, s: number, rot: number, fill = C.blue): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M 0 -18 C 3 -5, 5 -3, 18 0 C 5 3, 3 5, 0 18 C -3 5, -5 3, -18 0 C -5 -3, -3 -5, 0 -18 Z" fill="${fill}"/>
  </g>`;
}

function sArrow(x: number, y: number, s: number, rot: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M -22 6 C -8 -12, 8 -12, 20 2" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M 20 2 L 9 0 M 20 2 L 16 -9" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function sCursor(x: number, y: number, s: number, rot: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <path d="M 0 0 L 0 26 L 6 20 L 11 30 L 15 28 L 10 18 L 18 18 Z" fill="${C.ink}" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
  </g>`;
}

const STICKERS = [sCherry, sStar, sSparkle, sArrow, sCursor];

/**
 * Scatter decorations around the edges.
 *
 * Placement is confined to the margins and corners so a sticker never lands on
 * a word: the collage look is worth nothing if it costs legibility.
 */
function decorate(seed: string, count: number): string {
  const r = rng(seed);
  const spots: Array<[number, number]> = [
    [PAD + 10, 140], [W - PAD - 30, 190], [PAD - 10, H - 210], [W - PAD - 10, H - 160],
    [W - PAD - 70, 430], [PAD + 50, 560], [W - PAD, 700], [PAD + 40, 860],
  ];
  const used = new Set<number>();
  let out = "";
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    let idx = Math.floor(r() * spots.length);
    // Two stickers in one spot read as a mistake rather than as a collage.
    let guard = 0;
    while (used.has(idx) && guard++ < spots.length) idx = (idx + 1) % spots.length;
    used.add(idx);
    const [x, y] = spots[idx];
    const draw = STICKERS[Math.floor(r() * STICKERS.length)];
    // The spec sets sticker width to 60px; the glyphs are drawn on roughly a
    // 36px box, so 1.65 is 60px, with a little jitter either side.
    out += draw(x, y, 1.5 + r() * 0.3, -25 + r() * 50);
  }
  return out;
}

// -- slide parts ------------------------------------------------------------

/**
 * The spec's `.highlight` rule, as SVG:
 *   background #fce7f3, padding 2px 8px, border-radius 4px, rotate(-1deg)
 *
 * Scaled from its 16px CSS reference to whatever size the headline settled at,
 * so the padding stays proportional instead of vanishing under 70px type.
 */
function highlightRect(x: number, y: number, w: number, size: number, fill: string): string {
  const padX = size * 0.5;    // 8px at a 16px base
  const padY = size * 0.125;  // 2px at a 16px base
  const rx = size * 0.25;     // 4px at a 16px base
  const bx = x - padX;
  const by = y - size * 0.80 - padY;
  const bw = w + padX * 2;
  const bh = size + padY * 2;
  // rotate(-1deg) about the box's own centre, matching transform-origin: center.
  return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${rx.toFixed(1)}" fill="${fill}" transform="rotate(-1 ${(bx + bw / 2).toFixed(1)} ${(by + bh / 2).toFixed(1)})"/>`;
}

/**
 * Draw the headline, painting the highlighter behind THE MARKED PHRASE ONLY.
 *
 * The first pass swiped the whole line, reasoning that measuring a substring
 * without a text engine is guesswork. That was wrong: a substring's offset is
 * measured with exactly the same glyph-width approximation already used to wrap
 * the line, so it is no more of a guess than the wrapping is. And the spec's
 * `display: inline-block` means the swipe belongs to the phrase, not the line —
 * a line-wide swipe reads as a redaction bar.
 */
function headline(title: string, y0: number, seed: string): { svg: string; endY: number } {
  const { plain, marked } = parseHighlights(title);
  const t = fit(plain, W - PAD * 2, 72, 38, 4, GW.sansBold);
  const per = t.size * GW.sansBold;
  const r = rng(seed + "hl");
  let out = "";
  let y = y0;

  t.lines.forEach((line) => {
    const lower = line.toLowerCase();
    // Wrapping can split a phrase across two lines, so each line is searched for
    // whichever part of it landed there.
    for (const phrase of marked) {
      for (const frag of [phrase, ...phrase.split(/\s+/)]) {
        if (frag.length < 3) continue;
        const at = lower.indexOf(frag.toLowerCase());
        if (at === -1) continue;
        out += highlightRect(PAD + at * per, y, frag.length * per, t.size, C.pink);
        break;
      }
    }
    // A degree of rotation per line is what stops this reading as a text box.
    const rot = (r() * 1.6 - 0.8).toFixed(2);
    out += `<text x="${PAD}" y="${y}" transform="rotate(${rot} ${PAD} ${y})" font-family="${SANS}" font-size="${t.size}" font-weight="800" fill="${C.ink}">${esc(line)}</text>`;
    y += t.size * 1.14;
  });
  return { svg: out, endY: y };
}

/** The pasted quote card: attributed text, a name, and a job title beneath it. */
function quoteCard(text: string, author: string | undefined, role: string | undefined, y0: number): string {
  const t = fit(`"${text}"`, 760, 30, 20, 6, GW.serif);
  const cardH = t.lines.length * (t.size + 10) + (author ? 92 : 46);
  let out = `<g transform="rotate(-1.2 ${W / 2} ${y0 + cardH / 2})">
    <rect x="86" y="${y0}" width="${W - 172}" height="${cardH}" rx="18" fill="#00000010"/>
    <rect x="80" y="${y0 - 6}" width="${W - 172}" height="${cardH}" rx="18" fill="${C.card}" stroke="${C.line}" stroke-width="1.5"/>`;
  let y = y0 + 44;
  t.lines.forEach((line) => {
    out += `<text x="116" y="${y}" font-family="${SERIF}" font-style="italic" font-size="${t.size}" fill="${C.body}">${esc(line)}</text>`;
    y += t.size + 10;
  });
  if (author) {
    out += `<text x="116" y="${y + 22}" font-family="${SANS}" font-size="24" font-weight="700" fill="${C.ink}">${esc(author)}</text>`;
    if (role) {
      out += `<text x="116" y="${y + 52}" font-family="${SANS}" font-size="17" letter-spacing="1.2" fill="${C.muted}">${esc(role.toUpperCase().slice(0, 46))}</text>`;
    }
  }
  return out + "</g>";
}

function ground(seed: string): string {
  const r = rng(seed + "bg");
  // Two soft pastel blooms at low opacity - the gradient wash under the collage.
  return `<rect width="${W}" height="${H}" fill="${C.cream}"/>
    <circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 400).toFixed(0)}" r="360" fill="${C.pink}" opacity="0.30"/>
    <circle cx="${(r() * W).toFixed(0)}" cy="${(H - r() * 400).toFixed(0)}" r="320" fill="${C.mint}" opacity="0.28"/>`;
}

// -- deck -------------------------------------------------------------------

export interface ScrapbookOptions {
  seed?: string;
  author?: string;
  /** Job title shown under the name on quote cards. */
  authorRole?: string;
}

export async function renderScrapbookDeck(
  slides: KoyopoSlide[],
  opts: ScrapbookOptions = {}
): Promise<Buffer[]> {
  const seed = opts.seed ?? "scrapbook";
  const out: Buffer[] = [];

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const slideSeed = `${seed}-${i}`;
    let svg = ground(slideSeed);

    const isCover = i === 0 || s.template === "title";
    const head = headline(s.title ?? "", isCover ? 330 : 200, slideSeed);
    svg += head.svg;

    // Quote slides get the pasted card; everything else gets its body as prose.
    const quoteText = s.template === "quote" ? (s.body ?? s.subtitle) : undefined;
    if (quoteText) {
      svg += quoteCard(quoteText, opts.author, opts.authorRole, head.endY + 56);
    } else if (s.body) {
      const b = fit(s.body.replace(/\n+/g, " "), 840, 30, 21, 6, GW.sans);
      let y = head.endY + 54;
      b.lines.forEach((line) => {
        svg += `<text x="${PAD}" y="${y}" font-family="${SANS}" font-size="${b.size}" fill="${C.body}">${esc(line)}</text>`;
        y += b.size + 14;
      });
    }

    // Fewer stickers on the cover: the headline is doing the work there.
    svg += decorate(slideSeed, isCover ? 3 : 4);

    if (!isCover) {
      svg += `<text x="${W / 2}" y="${H - 46}" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="600" fill="${C.muted}">${i}</text>`;
    }

    out.push(await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${poppinsCss()}${svg}</svg>`)).png().toBuffer());
  }
  return out;
}
