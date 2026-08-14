import sharp from "sharp";

/**
 * LinkedIn profile banner — 1584 × 396, rendered as a real downloadable PNG.
 *
 * The brief this consumes follows the positioning workbook: a tagline that is a
 * POV rather than a job title, three capability pillars, name, contact, and a
 * simple line diagram. The layout constraint that drives everything: LinkedIn
 * overlays the profile photo bottom-left and crops the banner hard on mobile,
 * so the left ~22% is kept empty and nothing meaningful sits in the bottom 18%.
 *
 * Same technique as the deck renderers — SVG drawn here, rasterised by sharp.
 * No image API, no key, no cost.
 */

export const BANNER = { width: 1584, height: 396 } as const;
/** Profile photo + its ring, plus breathing room. Nothing readable goes here. */
const SAFE_LEFT = 0.235;
/** Mobile crops the bottom of the banner behind the photo/name block. */
const SAFE_BOTTOM = 0.16;

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

export interface BannerBrief {
  /** Max ~8 words. A POV or philosophy, never a job title. */
  tagline: string;
  /** Exactly 3, max 3 words each. */
  pillars: string[];
  name: string;
  email?: string;
  /** One of the diagram concepts below. */
  visual?: BannerVisual;
}

export type BannerVisual = "arc" | "layers" | "signal" | "grid" | "path";

export interface BannerTheme {
  bg: string;
  /** Faint wash behind the diagram side. */
  glow: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
}

/**
 * Executive palettes. All dark-ground: a banner sits directly under a bright
 * feed and above a white profile card, and dark is what reads as senior there —
 * plus white type on dark survives LinkedIn's aggressive mobile downscaling.
 */
export const BANNER_THEMES: Record<string, BannerTheme> = {
  navy:     { bg: "#0B1F3A", glow: "#153A63", ink: "#FFFFFF", muted: "#A9BCD1", accent: "#C9A227", rule: "rgba(255,255,255,0.14)" },
  graphite: { bg: "#16181D", glow: "#262A33", ink: "#FFFFFF", muted: "#A8ADB8", accent: "#E0A82E", rule: "rgba(255,255,255,0.12)" },
  forest:   { bg: "#10241C", glow: "#1B3D2E", ink: "#FFFFFF", muted: "#A3BDB0", accent: "#D8C173", rule: "rgba(255,255,255,0.12)" },
  slate:    { bg: "#101B26", glow: "#1D3245", ink: "#FFFFFF", muted: "#9FB3C6", accent: "#4F9CF9", rule: "rgba(255,255,255,0.12)" },
  ivory:    { bg: "#F4F1EA", glow: "#E6E0D3", ink: "#16181D", muted: "#6B6459", accent: "#B5452F", rule: "rgba(0,0,0,0.10)" },
};

export type BannerThemeName = keyof typeof BANNER_THEMES;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(t: string, maxW: number, px: number, w: keyof typeof GLYPH_W): string[] {
  const maxChars = Math.max(4, Math.floor(maxW / (px * GLYPH_W[w])));
  const out: string[] = [];
  let line = "";
  for (const word of t.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if ((line + " " + word).length <= maxChars) line += " " + word;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

function fit(t: string, maxW: number, start: number, min: number, maxLines: number, w: keyof typeof GLYPH_W = "bold") {
  for (let px = start; px >= min; px -= 2) {
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
 * The diagram. Each is a single-stroke line drawing that restates the tagline
 * as a shape — the workbook's "clean, hand-drawn" brief, drawn geometrically so
 * it stays crisp when LinkedIn resamples the banner.
 */
function diagram(kind: BannerVisual, cx: number, cy: number, s: number, K: BannerTheme): string {
  const st = `stroke="${K.accent}" fill="none" stroke-width="${Math.max(2, s * 0.02)}" stroke-linecap="round" stroke-linejoin="round"`;
  const dim = `stroke="${K.muted}" fill="none" stroke-width="${Math.max(1.5, s * 0.014)}" stroke-linecap="round" opacity="0.55"`;

  switch (kind) {
    // Insight → foresight: a flat line that bends upward past a marked pivot.
    case "arc":
      return `<g>
        <path d="M${cx - s * 0.46} ${cy + s * 0.22} L${cx - s * 0.06} ${cy + s * 0.2}" ${dim}/>
        <path d="M${cx - s * 0.06} ${cy + s * 0.2} Q${cx + s * 0.2} ${cy + s * 0.16} ${cx + s * 0.44} ${cy - s * 0.28}" ${st}/>
        <circle cx="${cx - s * 0.06}" cy="${cy + s * 0.2}" r="${s * 0.035}" fill="${K.accent}"/>
        <path d="M${cx + s * 0.3} ${cy - s * 0.24} L${cx + s * 0.45} ${cy - s * 0.29} L${cx + s * 0.41} ${cy - s * 0.13}" ${st}/>
      </g>`;
    // Systems built in layers — the stack that holds under load.
    case "layers":
      return `<g>
        <path d="M${cx} ${cy - s * 0.34} L${cx + s * 0.42} ${cy - s * 0.12} L${cx} ${cy + s * 0.1} L${cx - s * 0.42} ${cy - s * 0.12} Z" ${st}/>
        <path d="M${cx - s * 0.42} ${cy + s * 0.06} L${cx} ${cy + s * 0.28} L${cx + s * 0.42} ${cy + s * 0.06}" ${dim}/>
        <path d="M${cx - s * 0.42} ${cy + s * 0.22} L${cx} ${cy + s * 0.44} L${cx + s * 0.42} ${cy + s * 0.22}" ${dim}/>
      </g>`;
    // Noise resolving into signal.
    case "signal":
      return `<g>
        <path d="M${cx - s * 0.46} ${cy} q${s * 0.06} -${s * 0.3} ${s * 0.12} 0 q${s * 0.06} ${s * 0.3} ${s * 0.12} 0 q${s * 0.06} -${s * 0.22} ${s * 0.12} 0 q${s * 0.06} ${s * 0.18} ${s * 0.12} 0" ${dim}/>
        <path d="M${cx + s * 0.02} ${cy} L${cx + s * 0.16} ${cy}" ${dim}/>
        <path d="M${cx + s * 0.16} ${cy} L${cx + s * 0.28} ${cy - s * 0.26} L${cx + s * 0.36} ${cy + s * 0.1} L${cx + s * 0.46} ${cy - s * 0.34}" ${st}/>
      </g>`;
    // Scattered inputs, one ordered output.
    case "grid": {
      const dots: string[] = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const on = (r + c) % 2 === 0;
        dots.push(`<circle cx="${cx - s * 0.4 + c * s * 0.17}" cy="${cy - s * 0.24 + r * s * 0.24}" r="${s * (on ? 0.035 : 0.022)}" fill="${on ? K.accent : K.muted}" opacity="${on ? 1 : 0.5}"/>`);
      }
      return `<g>${dots.join("")}<path d="M${cx - s * 0.02} ${cy} L${cx + s * 0.44} ${cy}" ${st}/><path d="M${cx + s * 0.34} ${cy - s * 0.07} L${cx + s * 0.45} ${cy} L${cx + s * 0.34} ${cy + s * 0.07}" ${st}/></g>`;
    }
    // "Never as simple as A to B" — the real path between two points.
    case "path":
    default:
      return `<g>
        <circle cx="${cx - s * 0.42}" cy="${cy + s * 0.24}" r="${s * 0.04}" fill="${K.muted}"/>
        <path d="M${cx - s * 0.42} ${cy + s * 0.24} L${cx + s * 0.42} ${cy - s * 0.26}" ${dim} stroke-dasharray="${s * 0.05} ${s * 0.05}"/>
        <path d="M${cx - s * 0.42} ${cy + s * 0.24} C${cx - s * 0.1} ${cy + s * 0.5} ${cx - s * 0.2} ${cy - s * 0.3} ${cx + s * 0.08} ${cy - s * 0.06} C${cx + s * 0.26} ${cy + s * 0.08} ${cx + s * 0.24} ${cy - s * 0.3} ${cx + s * 0.42} ${cy - s * 0.26}" ${st}/>
        <circle cx="${cx + s * 0.42}" cy="${cy - s * 0.26}" r="${s * 0.045}" fill="${K.accent}"/>
      </g>`;
  }
}

export interface BannerOptions {
  theme?: BannerThemeName;
  /** 2 renders at 3168×792 for retina-sharp uploads. */
  scale?: 1 | 2;
}

export function bannerSvg(brief: BannerBrief, opts: BannerOptions = {}): string {
  const W = BANNER.width;
  const H = BANNER.height;
  const K = BANNER_THEMES[opts.theme ?? "navy"] ?? BANNER_THEMES.navy;

  const left = Math.round(W * SAFE_LEFT);
  const right = Math.round(W * 0.055);
  const bottomSafe = Math.round(H * SAFE_BOTTOM);

  // The diagram occupies the right third; type gets everything between.
  const artW = Math.round(W * 0.2);
  const textW = W - left - right - artW - Math.round(W * 0.03);

  const parts: string[] = [];

  // Ground: flat colour plus one soft radial on the art side, so the diagram has
  // something to sit on without the banner becoming a gradient.
  parts.push(`<defs>
    <radialGradient id="g" cx="0.78" cy="0.4" r="0.6">
      <stop offset="0" stop-color="${K.glow}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${K.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="${K.bg}"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);

  // Hairline that ties the left safe zone to the type block.
  parts.push(`<rect x="${left - Math.round(W * 0.022)}" y="${Math.round(H * 0.24)}" width="3" height="${Math.round(H * 0.5)}" fill="${K.accent}" opacity="0.9"/>`);

  // ── Tagline: the loudest element on the banner ──
  const tag = fit(brief.tagline, textW, 62, 34, 2, "bold");
  const pillars = brief.pillars.filter(Boolean).slice(0, 3);
  const blockH = tag.lines.length * Math.round(tag.px * 1.14) + (pillars.length ? 46 : 0) + 34;
  let y = Math.round((H - bottomSafe - blockH) / 2) + tag.px;

  tag.lines.forEach((ln) => {
    parts.push(T(ln, left, y, tag.px, { fill: K.ink, weight: 800, tracking: -tag.px * 0.02 }));
    y += Math.round(tag.px * 1.14);
  });

  // ── Pillars ──
  if (pillars.length) {
    y += 10;
    const label = pillars.map((p) => p.toUpperCase()).join("   |   ");
    const p = fit(label, textW, 21, 13, 1, "bold");
    parts.push(T(p.lines[0] ?? label, left, y, p.px, { fill: K.accent, weight: 600, tracking: p.px * 0.13 }));
    y += 34;
  }

  // ── Name + contact, small and last ──
  const idParts = [brief.name, brief.email].filter(Boolean) as string[];
  if (idParts.length) {
    parts.push(`<rect x="${left}" y="${y - 4}" width="${Math.round(textW * 0.5)}" height="1" fill="${K.rule}"/>`);
    parts.push(T(idParts.join("   ·   "), left, y + 28, 19, { fill: K.muted, weight: 500 }));
  }

  // ── Diagram ──
  const artCx = W - right - artW / 2;
  parts.push(diagram(brief.visual ?? "arc", artCx, Math.round(H * 0.46), Math.min(artW, Math.round(H * 0.78)), K));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${parts.join("\n  ")}
</svg>`;
}

export async function renderBanner(brief: BannerBrief, opts: BannerOptions = {}): Promise<Buffer> {
  const scale = opts.scale ?? 2;
  return sharp(Buffer.from(bannerSvg(brief, opts)), { density: 72 * scale })
    .resize(BANNER.width * scale, BANNER.height * scale)
    .png()
    .toBuffer();
}
