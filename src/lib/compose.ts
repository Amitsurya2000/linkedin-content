import sharp from "sharp";

/**
 * Text-overlay compositor (concept-first, low-text architecture).
 *
 * Guarantees ZERO spelling mistakes: the AI generates a text-free premium
 * background, and we render the text ourselves with a real font. Following the
 * masterclass design philosophy, an image carries at most three text elements:
 *   1. a small eyebrow BADGE pill (2-3 words)
 *   2. ONE hook line (the only large text, 4-9 words)
 *   3. a CTA pill (2-4 words)
 * Total on-image copy stays under ~20 words.
 */

export interface OverlayTheme {
  fg: string; // main hook color
  accent: string; // highlight color for the last word(s) + pills
  badge?: string; // eyebrow pill label (small, top)
  cta?: string; // call-to-action pill (bottom)
  font: "serif" | "sans" | "mono";
  align: "center" | "left";
  scrim: "none" | "dark" | "light" | "panel-dark" | "panel-light" | "gradient-bottom";
  letterSpacing?: number;
  accentWords?: number; // trailing words to accent (ignored if text has **marks**)
  uppercase?: boolean;
  position?: "top" | "center" | "bottom";
  maxLines?: number;
  author?: string; // italic sign-off line under the hook ("— Name")
  underline?: boolean; // gold brush underline under the accented word(s)
  // Editorial graphic accents (app-drawn, always clean — never AI clutter).
  graphic?: "none" | "frame" | "watermark" | "icon" | "divider";
  graphicIcon?: string; // key into LINE_ICONS (for graphic === "icon")
  watermark?: string; // big faint number/text (for graphic === "watermark")
  eyebrow?: string; // small tracked-out label above the hook (e.g. "POSITIONING")
}

// ── Professional minimalist line-icons (thin stroke, editorial) ──────────────
// Each returns SVG drawn centered at (cx,cy) within radius r, stroked in `c`.
export const LINE_ICONS: Record<string, (cx: number, cy: number, r: number, c: string) => string> = {
  target: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none"><circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y}" r="${r * 0.55}"/><circle cx="${x}" cy="${y}" r="${r * 0.12}" fill="${c}"/></g>`,
  growth: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M${x - r} ${y + r * 0.7} L${x - r * 0.3} ${y - r * 0.1} L${x + r * 0.2} ${y + r * 0.35} L${x + r} ${y - r * 0.6}"/><path d="M${x + r * 0.45} ${y - r * 0.6} L${x + r} ${y - r * 0.6} L${x + r} ${y - r * 0.1}"/></g>`,
  key: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"><circle cx="${x - r * 0.45}" cy="${y}" r="${r * 0.45}"/><path d="M${x - r * 0.02} ${y} L${x + r} ${y} M${x + r * 0.6} ${y} l0 ${r * 0.32} M${x + r} ${y} l0 ${r * 0.32}"/></g>`,
  chain: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"><rect x="${x - r}" y="${y - r * 0.32}" width="${r * 0.9}" height="${r * 0.64}" rx="${r * 0.32}"/><rect x="${x + r * 0.1}" y="${y - r * 0.32}" width="${r * 0.9}" height="${r * 0.64}" rx="${r * 0.32}"/></g>`,
  bulb: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"><circle cx="${x}" cy="${y - r * 0.2}" r="${r * 0.6}"/><path d="M${x - r * 0.28} ${y + r * 0.45} L${x + r * 0.28} ${y + r * 0.45} M${x - r * 0.2} ${y + r * 0.7} L${x + r * 0.2} ${y + r * 0.7}"/></g>`,
  compass: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linejoin="round"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x - r * 0.35} ${y + r * 0.35} L${x + r * 0.15} ${y - r * 0.5} L${x + r * 0.35} ${y - r * 0.35} L${x - r * 0.15} ${y + r * 0.5} Z" fill="${c}"/></g>`,
  shield: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linejoin="round"><path d="M${x} ${y - r} L${x + r * 0.8} ${y - r * 0.6} L${x + r * 0.8} ${y + r * 0.15} Q${x + r * 0.8} ${y + r * 0.8} ${x} ${y + r} Q${x - r * 0.8} ${y + r * 0.8} ${x - r * 0.8} ${y + r * 0.15} L${x - r * 0.8} ${y - r * 0.6} Z"/></g>`,
  chart: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"><path d="M${x - r} ${y - r} L${x - r} ${y + r} L${x + r} ${y + r}"/><path d="M${x - r * 0.5} ${y + r * 0.4} L${x} ${y - r * 0.2} L${x + r * 0.4} ${y + r * 0.1} L${x + r} ${y - r * 0.7}"/></g>`,
  mountain: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linejoin="round"><path d="M${x - r} ${y + r * 0.7} L${x - r * 0.2} ${y - r * 0.5} L${x + r * 0.2} ${y + r * 0.1} L${x + r * 0.5} ${y - r * 0.7} L${x + r} ${y + r * 0.7} Z"/></g>`,
  clock: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x} ${y} L${x} ${y - r * 0.55} M${x} ${y} L${x + r * 0.4} ${y + r * 0.2}"/></g>`,
  spark: (x, y, r, c) => `<g stroke="${c}" stroke-width="${r * 0.09}" fill="none" stroke-linecap="round"><path d="M${x} ${y - r} L${x} ${y + r} M${x - r} ${y} L${x + r} ${y} M${x - r * 0.6} ${y - r * 0.6} L${x + r * 0.6} ${y + r * 0.6} M${x - r * 0.6} ${y + r * 0.6} L${x + r * 0.6} ${y - r * 0.6}"/></g>`,
};

/** Parse **marked** words → gold. Returns plain words + which are accented. */
function parseMarks(text: string): { plain: string; flags: boolean[] } {
  const words = text.split(/\s+/).filter(Boolean);
  const plainWords: string[] = [];
  const flags: boolean[] = [];
  for (const w of words) {
    const m = /^\*\*(.+?)\*\*([.,!?;:]*)$/.exec(w);
    if (m) { plainWords.push(m[1] + (m[2] || "")); flags.push(true); }
    else { plainWords.push(w); flags.push(false); }
  }
  return { plain: plainWords.join(" "), flags };
}

const FONT_STACK: Record<OverlayTheme["font"], string> = {
  serif: "Georgia, 'Times New Roman', 'Noto Serif', serif",
  sans: "Arial, Helvetica, 'Helvetica Neue', 'Noto Sans', sans-serif",
  mono: "'Courier New', 'DejaVu Sans Mono', monospace",
};
const SANS = FONT_STACK.sans;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Pick black or white text for best contrast on a given hex background. */
function readableOn(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#141414" : "#FFFFFF";
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

function layout(text: string, boxW: number, opts: { maxLines: number; maxFont: number; minFont: number }) {
  const glyph = 0.58;
  for (let fs = opts.maxFont; fs >= opts.minFont; fs -= 2) {
    const maxChars = Math.max(6, Math.floor(boxW / (fs * glyph)));
    const lines = wrap(text, maxChars);
    if (lines.length <= opts.maxLines && lines.every((l) => l.length <= maxChars)) return { fontSize: fs, lines };
  }
  const fs = opts.minFont;
  const maxChars = Math.max(6, Math.floor(boxW / (fs * glyph)));
  return { fontSize: fs, lines: wrap(text, maxChars).slice(0, opts.maxLines) };
}

/** A rounded pill (rect + centered label). cx is the pill CENTER x. */
function pill(text: string, cx: number, top: number, fs: number, bg: string, fg: string, arrow = false): { svg: string; height: number } {
  const label = text.toUpperCase() + (arrow ? "  →" : "");
  const est = label.length * fs * 0.6;
  const padX = fs * 1.05;
  const w = est + padX * 2;
  const h = Math.round(fs * 2.1);
  const x = Math.round(cx - w / 2);
  const rx = Math.round(h / 2);
  const svg = `<rect x="${x}" y="${top}" width="${Math.round(w)}" height="${h}" rx="${rx}" fill="${bg}"/>
    <text x="${cx}" y="${Math.round(top + h * 0.7)}" text-anchor="middle" font-family="${SANS}" font-size="${fs}" font-weight="700" letter-spacing="1.5" fill="${fg}">${esc(label)}</text>`;
  return { svg, height: h };
}

export interface ComposeOptions {
  width: number;
  height: number;
  text: string;
  theme: OverlayTheme;
}

/** Composite badge + hook + CTA over a text-free background buffer. */
export async function composeCard(bg: Buffer, opts: ComposeOptions): Promise<Buffer> {
  const { width: W, height: H, text, theme } = opts;
  const base = await sharp(bg).resize(W, H, { fit: "cover", position: "centre" }).png().toBuffer();

  const padX = Math.round(W * 0.1);
  const boxW = W - padX * 2;
  const marks = parseMarks(text);
  const headline = theme.uppercase ? marks.plain.toUpperCase() : marks.plain;
  const flags = marks.flags;
  const hasMarks = flags.some(Boolean);
  const hasBadge = !!theme.badge;
  const hasCta = !!theme.cta;

  const { fontSize, lines } = layout(headline, boxW, {
    maxLines: theme.maxLines ?? 3,
    maxFont: Math.round(W * 0.105),
    minFont: Math.round(W * 0.045),
  });

  const lineHeight = Math.round(fontSize * 1.16);
  const authorFs = theme.author ? Math.round(fontSize * 0.42) : 0;
  const authorGap = theme.author ? Math.round(authorFs * 2.6) : 0;
  const blockH = lines.length * lineHeight + authorGap;

  const pos = theme.position || "center";
  let blockTop: number;
  if (pos === "top") blockTop = Math.round(H * 0.14);
  else if (pos === "bottom") blockTop = Math.round(H - blockH - H * 0.18);
  else blockTop = Math.round((H - blockH) / 2);

  const firstBaseline = blockTop + Math.round(lineHeight * 0.78);
  const cx = theme.align === "center" ? Math.round(W / 2) : padX;
  const anchor = theme.align === "center" ? "middle" : "start";
  const ls = theme.letterSpacing ?? 0;

  const accentN = theme.accentWords ?? 0;
  const totalWords = headline.split(" ").length;
  const lineChars: number[] = [];
  let wordsSeen = 0;
  let lastAccentLine = -1;
  const textEls = lines
    .map((ln, idx) => {
      const y = firstBaseline + idx * lineHeight;
      lineChars[idx] = ln.length;
      const tspans = ln
        .split(" ")
        .map((w, wi) => {
          const gi = wordsSeen;
          wordsSeen++;
          const isAccent = hasMarks ? flags[gi] === true : accentN > 0 && gi >= totalWords - accentN;
          if (isAccent) lastAccentLine = idx;
          const fill = isAccent ? theme.accent : theme.fg;
          const lead = wi === 0 ? "" : " ";
          return `<tspan xml:space="preserve" fill="${fill}">${lead}${esc(w)}</tspan>`;
        })
        .join("");
      return `<text x="${cx}" y="${y}" text-anchor="${anchor}" xml:space="preserve" font-family="${FONT_STACK[theme.font]}" font-size="${fontSize}" font-weight="700" letter-spacing="${ls}">${tspans}</text>`;
    })
    .join("");

  // Gold brush underline under the accented line.
  let underlineEl = "";
  if (theme.underline) {
    const ul = lastAccentLine >= 0 ? lastAccentLine : lines.length - 1;
    const w = Math.min(boxW, Math.round(lineChars[ul] * fontSize * 0.5));
    const ux = theme.align === "center" ? Math.round(W / 2 - w / 2) : padX;
    const uy = firstBaseline + ul * lineHeight + Math.round(fontSize * 0.22);
    underlineEl = `<rect x="${ux}" y="${uy}" width="${w}" height="${Math.max(4, Math.round(fontSize * 0.07))}" rx="${Math.round(fontSize * 0.035)}" fill="${theme.accent}" opacity="0.92"/>`;
  }

  // Italic serif author sign-off under the block.
  let authorEl = "";
  if (theme.author) {
    const ay = firstBaseline + (lines.length - 1) * lineHeight + authorGap;
    authorEl = `<text x="${cx}" y="${ay}" text-anchor="${anchor}" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="${authorFs}" font-weight="500" fill="${theme.accent}">${esc("— " + theme.author)}</text>`;
  }

  // Editorial graphic accent (drawn by us — always clean, never AI clutter).
  let graphicEl = "";
  const g = theme.graphic || "none";
  if (g === "frame") {
    const t = Math.round(W * 0.06), L = Math.round(W * 0.055), sw = Math.max(2, Math.round(W * 0.0022));
    graphicEl = `<g stroke="${theme.accent}" stroke-width="${sw}" fill="none" opacity="0.85">
      <path d="M${t} ${t} h${L} M${t} ${t} v${L}"/><path d="M${W - t} ${t} h-${L} M${W - t} ${t} v${L}"/>
      <path d="M${t} ${H - t} h${L} M${t} ${H - t} v-${L}"/><path d="M${W - t} ${H - t} h-${L} M${W - t} ${H - t} v-${L}"/></g>`;
  } else if (g === "watermark") {
    const wfs = Math.round(W * 0.34);
    graphicEl = `<text x="${Math.round(W * 0.07)}" y="${Math.round(H * 0.3)}" font-family="${SANS}" font-size="${wfs}" font-weight="800" fill="${theme.fg}" opacity="0.05">${esc(theme.watermark || "01")}</text>`;
  } else if (g === "icon" && theme.graphicIcon && LINE_ICONS[theme.graphicIcon]) {
    const r = Math.round(W * 0.045);
    const iy = Math.max(r + Math.round(H * 0.09), blockTop - Math.round(H * 0.06));
    graphicEl = LINE_ICONS[theme.graphicIcon](Math.round(W / 2), iy, r, theme.accent);
  } else if (g === "divider") {
    const dw = Math.round(W * 0.12), dy = blockTop - Math.round(H * 0.05);
    const dx = theme.align === "center" ? Math.round(W / 2 - dw / 2) : cx;
    graphicEl = `<rect x="${dx}" y="${dy}" width="${dw}" height="${Math.max(3, Math.round(W * 0.004))}" rx="2" fill="${theme.accent}"/>`;
  }

  // Small tracked-out eyebrow label above the hook.
  let eyebrowEl = "";
  if (theme.eyebrow) {
    const efs = Math.round(fontSize * 0.28);
    const ey = blockTop - Math.round(efs * (g === "icon" ? -0.2 : 1.6));
    eyebrowEl = `<text x="${cx}" y="${ey}" text-anchor="${anchor}" font-family="${FONT_STACK[theme.font]}" font-size="${efs}" font-weight="700" letter-spacing="${Math.round(efs * 0.35)}" fill="${theme.accent}">${esc(theme.eyebrow.toUpperCase())}</text>`;
  }

  // Eyebrow badge pill (top)
  let badgeEl = "";
  if (hasBadge) {
    const bfs = Math.round(W * 0.026);
    const bcx = theme.align === "center" ? Math.round(W / 2) : padX + 1;
    const { svg } = pill(theme.badge!, theme.align === "center" ? bcx : bcx, Math.round(H * 0.06), bfs, theme.accent, readableOn(theme.accent));
    // left-align: shift pill so its left edge sits at padX
    if (theme.align !== "center") {
      const est = theme.badge!.toUpperCase().length * bfs * 0.6;
      const w = est + bfs * 2;
      badgeEl = pill(theme.badge!, Math.round(padX + w / 2), Math.round(H * 0.06), bfs, theme.accent, readableOn(theme.accent)).svg;
    } else {
      badgeEl = svg;
    }
  }

  // CTA pill (bottom center)
  let ctaEl = "";
  if (hasCta) {
    const cfs = Math.round(W * 0.03);
    const ch = Math.round(cfs * 2.1);
    ctaEl = pill(theme.cta!, Math.round(W / 2), Math.round(H - H * 0.08 - ch), cfs, theme.accent, readableOn(theme.accent), true).svg;
  }

  // Legibility scrim
  let scrim = "";
  if (theme.scrim === "dark") scrim = `<rect width="100%" height="100%" fill="black" opacity="0.34"/>`;
  else if (theme.scrim === "light") scrim = `<rect width="100%" height="100%" fill="white" opacity="0.28"/>`;
  else if (theme.scrim === "gradient-bottom") {
    // Cinematic dark gradient over the lower half for legible bottom text.
    scrim = `<rect x="0" y="${Math.round(H * 0.35)}" width="${W}" height="${Math.round(H * 0.65)}" fill="url(#grad)"/>`;
  } else if (theme.scrim === "panel-dark" || theme.scrim === "panel-light") {
    const panelPadY = Math.round(lineHeight * 0.7);
    const py = blockTop - panelPadY, ph = blockH + panelPadY * 2;
    const px = theme.align === "center" ? padX * 0.5 : padX * 0.6, pw = W - px * 2;
    const fill = theme.scrim === "panel-dark" ? "black" : "white";
    scrim = `<rect x="${px}" y="${Math.max(0, py)}" width="${pw}" height="${ph}" rx="24" fill="${fill}" opacity="0.42"/>`;
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="55%" stop-color="#000000" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    ${scrim}
    ${graphicEl}
    ${badgeEl}
    ${eyebrowEl}
    ${underlineEl}
    <g filter="url(#sh)">${textEls}</g>
    ${authorEl}
    ${ctaEl}
  </svg>`;

  return sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}

// ─── Carousel slides ─────────────────────────────────────────────────────────

export interface SlideSpec {
  kind: "cover" | "content" | "cta";
  number?: string; // "01"
  badge?: string; // eyebrow
  title: string;
  body?: string; // content slides only
  footer?: string; // e.g. "1 / 6"
}

/** Compose a single carousel slide (cover / content / cta) with perfect text. */
export async function composeSlide(
  bg: Buffer,
  opts: { width: number; height: number; slide: SlideSpec; theme: OverlayTheme }
): Promise<Buffer> {
  const { width: W, height: H, slide, theme } = opts;
  const base = await sharp(bg).resize(W, H, { fit: "cover", position: "centre" }).png().toBuffer();
  const padX = Math.round(W * 0.09);
  const boxW = W - padX * 2;
  const F = FONT_STACK[theme.font];
  // High-contrast body color derived from the hook color's brightness.
  const fgLight = readableOn(theme.fg) === "#141414"; // fg is a light color
  const muted = fgLight ? "#E4E7EB" : "#3C4046";

  // Scrim
  let scrim = "";
  if (theme.scrim === "dark") scrim = `<rect width="100%" height="100%" fill="black" opacity="0.34"/>`;
  else if (theme.scrim === "gradient-bottom") scrim = `<rect x="0" y="${Math.round(H * 0.35)}" width="${W}" height="${Math.round(H * 0.65)}" fill="url(#grad)"/>`;

  const parts: string[] = [];

  if (slide.kind === "cover") {
    // badge top, big title centered, swipe hint bottom
    if (slide.badge) {
      const bfs = Math.round(W * 0.028);
      parts.push(pill(slide.badge, Math.round(W / 2), Math.round(H * 0.12), bfs, theme.accent, readableOn(theme.accent)).svg);
    }
    const { fontSize, lines } = layout(theme.uppercase ? slide.title.toUpperCase() : slide.title, boxW, {
      maxLines: 4, maxFont: Math.round(W * 0.11), minFont: Math.round(W * 0.05),
    });
    const lh = Math.round(fontSize * 1.16);
    const top = Math.round((H - lines.length * lh) / 2 + fontSize * 0.78);
    lines.forEach((ln, i) => {
      parts.push(`<text x="${W / 2}" y="${top + i * lh}" text-anchor="middle" font-family="${F}" font-size="${fontSize}" font-weight="700" fill="${theme.fg}">${esc(ln)}</text>`);
    });
    const sfs = Math.round(W * 0.03);
    parts.push(pill("Swipe", Math.round(W / 2), Math.round(H - H * 0.12), sfs, theme.accent, readableOn(theme.accent), true).svg);
  } else if (slide.kind === "cta") {
    const { fontSize, lines } = layout(slide.title, boxW, { maxLines: 4, maxFont: Math.round(W * 0.1), minFont: Math.round(W * 0.05) });
    const lh = Math.round(fontSize * 1.16);
    const top = Math.round((H - lines.length * lh) / 2 + fontSize * 0.6);
    lines.forEach((ln, i) => {
      parts.push(`<text x="${W / 2}" y="${top + i * lh}" text-anchor="middle" font-family="${F}" font-size="${fontSize}" font-weight="700" fill="${theme.fg}">${esc(ln)}</text>`);
    });
    const cfs = Math.round(W * 0.034);
    parts.push(pill(theme.cta || "Follow for more", Math.round(W / 2), Math.round(H - H * 0.16), cfs, theme.accent, readableOn(theme.accent), true).svg);
  } else {
    // content: big number, title, body
    let y = Math.round(H * 0.16);
    if (slide.number) {
      const nfs = Math.round(W * 0.11);
      parts.push(`<text x="${padX}" y="${y + nfs}" font-family="${F}" font-size="${nfs}" font-weight="700" fill="${theme.accent}">${esc(slide.number)}</text>`);
      y += Math.round(nfs * 1.35);
    }
    const tl = layout(slide.title, boxW, { maxLines: 3, maxFont: Math.round(W * 0.072), minFont: Math.round(W * 0.045) });
    const tlh = Math.round(tl.fontSize * 1.18);
    y += tl.fontSize;
    tl.lines.forEach((ln) => {
      parts.push(`<text x="${padX}" y="${y}" font-family="${F}" font-size="${tl.fontSize}" font-weight="700" fill="${theme.fg}">${esc(ln)}</text>`);
      y += tlh;
    });
    if (slide.body) {
      y += Math.round(tl.fontSize * 0.4);
      // Auto-fit: shrink the body font until ALL wrapped lines fit above the
      // footer zone — the full copy is always rendered, never truncated.
      const availH = Math.round(H * 0.86) - y;
      const minBfs = Math.round(W * 0.026);
      let bfs = Math.round(W * 0.044);
      let bodyLines: string[] = wrap(slide.body, Math.floor(boxW / (bfs * 0.5)));
      let blh = Math.round(bfs * 1.4);
      for (; bfs > minBfs; bfs -= 2) {
        bodyLines = wrap(slide.body, Math.floor(boxW / (bfs * 0.5)));
        blh = Math.round(bfs * 1.4);
        if (bodyLines.length * blh <= availH) break;
      }
      y += bfs;
      bodyLines.forEach((ln) => {
        parts.push(`<text x="${padX}" y="${y}" font-family="${F}" font-size="${bfs}" font-weight="400" fill="${muted}">${esc(ln)}</text>`);
        y += blh;
      });
    }
    if (slide.footer) {
      const ffs = Math.round(W * 0.03);
      parts.push(`<text x="${W - padX}" y="${H - Math.round(H * 0.06)}" text-anchor="end" font-family="${F}" font-size="${ffs}" font-weight="700" fill="${theme.accent}">${esc(slide.footer)}</text>`);
    }
    // thin accent rule under the number area
    parts.push(`<rect x="${padX}" y="${Math.round(H * 0.145)}" width="${Math.round(W * 0.14)}" height="4" rx="2" fill="${theme.accent}"/>`);
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.4"/></filter>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.85"/></linearGradient>
    </defs>
    ${scrim}
    <g filter="url(#sh)">${parts.join("")}</g>
  </svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
