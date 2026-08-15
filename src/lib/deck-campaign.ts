import sharp from "sharp";
import type { KoyopoSlide, SlideTemplate } from "./koyopo";

/**
 * "Campaign" deck — the saturated, poster-style deck run by brands and advocacy
 * accounts. Modelled on the Change 100 inclusive-hiring carousel.
 *
 * Every other renderer here is quiet: off-white grounds, one restrained accent,
 * left-aligned type. This one is the opposite and deliberately so — a single
 * loud colour edge to edge, centred type at poster scale, and hard-angled
 * geometry. It is what a campaign or a company page posts, where the job is to
 * stop a scroll with colour rather than to read as one person's notebook.
 *
 * The four devices that make the reference work, in the order the eye hits them:
 *   1. a SKEWED TAB top-left carrying the section label — a flag, not a chip
 *   2. a skewed brand lockup top-right, mirroring it
 *   3. centred display type filling the middle third, white or accent
 *   4. thin angular outlines bleeding off the edges, in two secondary colours
 *
 * Nothing is rounded anywhere. The whole language is straight edges and acute
 * angles; a rounded corner would read as a different deck.
 */

export const CAMPAIGN_CANVAS = { width: 1080, height: 1350 } as const;

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

export interface CampaignTheme {
  /** Full-bleed saturated ground. */
  bg: string;
  /** The skewed label tab. */
  tab: string;
  onTab: string;
  /** The brand lockup, top-right. */
  chip: string;
  onChip: string;
  /** Display type on the ground. */
  ink: string;
  /** Emphasis colour for cover and closing titles. */
  accent: string;
  /** The two angular outline colours. */
  line1: string;
  line2: string;
}

/**
 * Each palette is one dominant hue plus a warm tab and a cool accent — the
 * reference's own structure. They are loud on purpose; a desaturated version of
 * this layout is just a worse version of the Minimal deck.
 */
export const CAMPAIGN_THEMES: Record<string, CampaignTheme> = {
  violet:  { bg: "#6D28D9", tab: "#F97316", onTab: "#FFFFFF", chip: "#2DD4BF", onChip: "#0F172A", ink: "#FFFFFF", accent: "#22D3EE", line1: "#38BDF8", line2: "#E11D48" },
  crimson: { bg: "#BE123C", tab: "#FBBF24", onTab: "#3B0714", chip: "#FDE68A", onChip: "#3B0714", ink: "#FFFFFF", accent: "#FDE047", line1: "#FDA4AF", line2: "#7C2D12" },
  ocean:   { bg: "#0E7490", tab: "#F97316", onTab: "#FFFFFF", chip: "#A7F3D0", onChip: "#064E3B", ink: "#FFFFFF", accent: "#FDE047", line1: "#67E8F9", line2: "#F97316" },
  forest:  { bg: "#166534", tab: "#FACC15", onTab: "#1A2E05", chip: "#BBF7D0", onChip: "#14532D", ink: "#FFFFFF", accent: "#FDE047", line1: "#86EFAC", line2: "#EA580C" },
  midnight:{ bg: "#1E1B4B", tab: "#F472B6", onTab: "#3B0764", chip: "#A5B4FC", onChip: "#1E1B4B", ink: "#FFFFFF", accent: "#818CF8", line1: "#38BDF8", line2: "#F472B6" },
};

export type CampaignThemeName = keyof typeof CAMPAIGN_THEMES;

export function pickCampaignTheme(seed: string): { name: CampaignThemeName; theme: CampaignTheme } {
  const names = Object.keys(CAMPAIGN_THEMES) as CampaignThemeName[];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const name = names[h % names.length];
  return { name, theme: CAMPAIGN_THEMES[name] };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function textW(s: string, px: number, w: keyof typeof GLYPH_W = "bold"): number {
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
  const { fill = "#FFFFFF", weight = 400, anchor = "start", tracking = 0 } = o;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${px}" font-weight="${weight}"${tracking ? ` letter-spacing="${tracking}"` : ""} fill="${fill}">${esc(s)}</text>`;
}

/**
 * The skewed tab. `dir` controls which way the slant leans so the top-left and
 * top-right marks mirror each other rather than pointing the same way.
 */
function skewTab(
  x: number, y: number, w: number, h: number, skew: number,
  fill: string, dir: "right" | "left"
): string {
  const pts =
    dir === "right"
      ? `${x},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`
      : `${x + skew},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
  return `<polygon points="${pts}" fill="${fill}"/>`;
}

const HERO = new Set<SlideTemplate>(["title", "divider", "quote"]);

export interface CampaignOptions {
  seed?: string;
  theme?: CampaignThemeName;
  /** Printed inside the top-right lockup. Falls back to the section tag. */
  brand?: string;
  pageNumber?: number;
  pageTotal?: number;
}

export async function renderCampaignSlide(slide: KoyopoSlide, opts: CampaignOptions = {}): Promise<Buffer> {
  const { width: W, height: H } = CAMPAIGN_CANVAS;
  const K = opts.theme ? CAMPAIGN_THEMES[opts.theme] : pickCampaignTheme(opts.seed ?? "default").theme;
  const isHero = HERO.has(slide.template);
  const pad = 76;
  const parts: string[] = [];

  // ── Angular outlines, bled off the edges ──
  // Thin, unfilled, and deliberately cropped by the frame: a shape that fits
  // entirely inside the slide reads as an illustration, whereas one running off
  // the edge reads as pattern, which is what the reference does.
  const sw = 4;
  parts.push(
    `<polyline points="${W * 0.1},${H * 0.12} ${W * 0.62},${H * 0.24} ${W * 0.06},${H * 0.52}"
      fill="none" stroke="${K.line1}" stroke-width="${sw}" opacity="0.65"/>`,
    `<polyline points="${W * 0.94},${H * 0.62} ${W * 0.36},${H * 0.78} ${W * 1.02},${H * 0.95}"
      fill="none" stroke="${K.line2}" stroke-width="${sw}" opacity="0.55"/>`
  );

  // ── Top-left label tab ──
  const label = (slide.sectionTag || (isHero ? "" : "How?")).slice(0, 22);
  const tabH = 92;
  const tabY = pad - 10;
  if (label) {
    const lf = fit(label, 320, 30, 18, 1, "bold");
    const tw = textW(lf.lines[0] ?? label, lf.px, "bold") + 92;
    parts.push(skewTab(0, tabY, tw + pad, tabH, 34, K.tab, "right"));
    parts.push(T(lf.lines[0] ?? label, pad, tabY + tabH * 0.63, lf.px, { fill: K.onTab, weight: 700 }));
  }

  // ── Top-right brand lockup ──
  const brand = (opts.brand ?? "").trim();
  if (brand) {
    const words = brand.split(/\s+/);
    const l1 = words[0].slice(0, 12);
    const l2 = words.slice(1).join(" ").slice(0, 12);
    const bw = Math.max(textW(l1, 26), textW(l2, 34)) + 76;
    const bx = W - bw;
    parts.push(skewTab(bx, tabY, bw, tabH, 30, K.chip, "left"));
    parts.push(T(l1, bx + bw / 2 + 8, tabY + (l2 ? 36 : 58), 22, { fill: K.onChip, weight: 700, anchor: "middle" }));
    if (l2) parts.push(T(l2, bx + bw / 2 + 8, tabY + 74, 34, { fill: K.onChip, weight: 800, anchor: "middle" }));
  }

  // ── Centred display type ──
  // Cover and closing slides take the accent colour; content slides stay white,
  // so the accent marks the deck's start and end rather than shouting on every
  // frame.
  const titleFill = isHero ? K.accent : K.ink;
  const boxW = W - pad * 2;
  const t = fit(slide.title ?? "", boxW, isHero ? 82 : 64, 34, 5, "bold");
  const lh = Math.round(t.px * 1.2);

  const body = slide.items?.length
    ? slide.items.slice(0, 3).join("\n")
    : (slide.body ?? slide.subtitle ?? "").trim();
  const b = body ? fit(body, boxW - 60, 28, 19, 5) : null;
  const bodyH = b ? b.lines.length * Math.round(b.px * 1.45) + 44 : 0;

  const blockH = t.lines.length * lh + bodyH;
  let y = Math.round((H - blockH) / 2) + Math.round(t.px * 0.34);

  t.lines.forEach((ln) => {
    parts.push(T(ln, W / 2, y, t.px, { fill: titleFill, weight: 800, anchor: "middle", tracking: -t.px * 0.02 }));
    y += lh;
  });

  if (b) {
    y += 30;
    b.lines.forEach((ln) => {
      parts.push(T(ln, W / 2, y, b.px, { fill: "rgba(255,255,255,0.88)", anchor: "middle" }));
      y += Math.round(b.px * 1.45);
    });
  }

  // ── Page counter, centred under everything ──
  if (opts.pageNumber && opts.pageTotal) {
    parts.push(T(`${opts.pageNumber} / ${opts.pageTotal}`, W / 2, H - 74, 22, {
      fill: "rgba(255,255,255,0.55)", weight: 600, anchor: "middle", tracking: 2,
    }));
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${K.bg}"/>
  ${parts.join("\n  ")}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderCampaignDeck(slides: KoyopoSlide[], opts: CampaignOptions = {}): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (let i = 0; i < slides.length; i++) {
    out.push(await renderCampaignSlide(slides[i], { ...opts, pageNumber: i + 1, pageTotal: slides.length }));
  }
  return out;
}
