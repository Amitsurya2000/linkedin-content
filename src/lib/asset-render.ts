import sharp from "sharp";

/**
 * Free vector renderers for the non-carousel visual assets: profile photos,
 * Featured-section covers and newsletter covers.
 *
 * Same technique as the deck renderers — SVG composed here, rasterised by
 * sharp. No image API and no second key: the only network call anywhere in this
 * feature set is Gemini writing the copy.
 *
 * The profile photo is the one that needs a real bitmap, because a face cannot
 * be drawn. It takes an uploaded photograph and does what a photographer's
 * retouch would: crop square, mask to a circle, drop it on a graded ground and
 * ring it in the accent colour.
 */

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

export interface AssetTheme {
  bg: string;
  glow: string;
  ink: string;
  muted: string;
  accent: string;
  onAccent: string;
}

export const ASSET_THEMES: Record<string, AssetTheme> = {
  navy:     { bg: "#0B1F3A", glow: "#153A63", ink: "#FFFFFF", muted: "#A9BCD1", accent: "#C9A227", onAccent: "#0B1F3A" },
  graphite: { bg: "#16181D", glow: "#262A33", ink: "#FFFFFF", muted: "#A8ADB8", accent: "#E0A82E", onAccent: "#16181D" },
  forest:   { bg: "#10241C", glow: "#1B3D2E", ink: "#FFFFFF", muted: "#A3BDB0", accent: "#D8C173", onAccent: "#10241C" },
  slate:    { bg: "#101B26", glow: "#1D3245", ink: "#FFFFFF", muted: "#9FB3C6", accent: "#4F9CF9", onAccent: "#101B26" },
  ivory:    { bg: "#F4F1EA", glow: "#E6E0D3", ink: "#16181D", muted: "#6B6459", accent: "#B5452F", onAccent: "#FFFFFF" },
  paper:    { bg: "#F7F4EF", glow: "#EFE7DA", ink: "#1C1917", muted: "#94897E", accent: "#DF5638", onAccent: "#FFFFFF" },
};

export type AssetThemeName = keyof typeof ASSET_THEMES;

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

// ── 1. Profile photo ─────────────────────────────────────────────────────────

export const PHOTO_STYLES = ["ring", "halo", "duotone", "plain"] as const;
export type PhotoStyle = (typeof PHOTO_STYLES)[number];

/**
 * Turn an uploaded headshot into a LinkedIn profile photo: 800×800, square,
 * subject centred on a graded ground with an accent ring.
 *
 * LinkedIn crops the profile photo to a circle, so everything here is composed
 * for the circle — the square corners are never seen and exist only so the file
 * uploads cleanly.
 */
export async function renderProfilePhoto(
  photo: Buffer,
  opts: { theme?: AssetThemeName; style?: PhotoStyle; size?: number } = {}
): Promise<Buffer> {
  const S = opts.size ?? 800;
  const K = ASSET_THEMES[opts.theme ?? "navy"] ?? ASSET_THEMES.navy;
  const style = opts.style ?? "ring";

  // The face should sit slightly above centre and fill most of the frame, which
  // is what "cover" + top-biased positioning gives on a normal headshot.
  const inset = style === "plain" ? 0 : Math.round(S * 0.06);
  const inner = S - inset * 2;

  let subject = sharp(photo).resize(inner, inner, { fit: "cover", position: "top" });
  if (style === "duotone") {
    // Greyscale then tint toward the accent — reads as a deliberate treatment
    // rather than a filter, and survives being shrunk to 48px in the feed.
    subject = subject.greyscale().tint(K.accent);
  }
  const subjectPng = await subject.png().toBuffer();

  const mask = Buffer.from(
    `<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#fff"/></svg>`
  );
  const masked = await sharp(subjectPng).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();

  const ringW = Math.round(S * 0.022);
  const ground = `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="0.5" cy="0.35" r="0.75">
        <stop offset="0" stop-color="${K.glow}"/>
        <stop offset="1" stop-color="${K.bg}"/>
      </radialGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
    ${style === "halo" ? `<circle cx="${S / 2}" cy="${S / 2}" r="${S * 0.46}" fill="${K.accent}" opacity="0.18"/>` : ""}
  </svg>`;

  const overlay =
    style === "plain"
      ? ""
      : `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${S / 2}" cy="${S / 2}" r="${S / 2 - inset + ringW / 2}" fill="none" stroke="${K.accent}" stroke-width="${ringW}"/>
        </svg>`;

  const layers: sharp.OverlayOptions[] = [{ input: masked, left: inset, top: inset }];
  if (overlay) layers.push({ input: Buffer.from(overlay), left: 0, top: 0 });

  return sharp(Buffer.from(ground)).composite(layers).png().toBuffer();
}

// ── 2. Cover cards (Featured items, newsletter) ──────────────────────────────

export const COVER_SIZES = {
  /** LinkedIn Featured item thumbnail. */
  featured: { width: 1200, height: 627 },
  /** LinkedIn newsletter cover. */
  newsletter: { width: 1280, height: 720 },
  /** Square, for reuse as a post image. */
  square: { width: 1080, height: 1080 },
} as const;

export type CoverSize = keyof typeof COVER_SIZES;

export interface CoverSpec {
  kicker?: string;
  headline: string;
  sub?: string;
  footer?: string;
}

/**
 * A cover card: kicker, big headline, rule, subline, signature. Deliberately
 * type-only — a cover competing with the headline for attention is a cover that
 * fails at 200px wide in a profile grid.
 */
export function coverSvg(spec: CoverSpec, opts: { size?: CoverSize; theme?: AssetThemeName } = {}): string {
  const { width: W, height: H } = COVER_SIZES[opts.size ?? "featured"];
  const K = ASSET_THEMES[opts.theme ?? "navy"] ?? ASSET_THEMES.navy;
  const pad = Math.round(W * 0.075);
  const boxW = W - pad * 2;
  const parts: string[] = [];

  parts.push(`<defs><radialGradient id="g" cx="0.85" cy="0.15" r="0.75">
    <stop offset="0" stop-color="${K.glow}" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${K.glow}" stop-opacity="0"/>
  </radialGradient></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="${K.bg}"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);

  // A single accent corner block, bled off the top-right.
  parts.push(`<circle cx="${W * 1.0}" cy="${H * -0.06}" r="${W * 0.26}" fill="${K.accent}" opacity="0.14"/>`);

  let y = Math.round(H * 0.24);
  if (spec.kicker) {
    const kw = spec.kicker.toUpperCase().slice(0, 26);
    parts.push(`<rect x="${pad}" y="${y - Math.round(H * 0.045)}" width="${Math.round(H * 0.012)}" height="${Math.round(H * 0.06)}" rx="${Math.round(H * 0.006)}" fill="${K.accent}"/>`);
    parts.push(T(kw, pad + Math.round(H * 0.036), y, Math.round(H * 0.032), { fill: K.accent, weight: 700, tracking: H * 0.032 * 0.14 }));
    y += Math.round(H * 0.06);
  }

  const head = fit(spec.headline, boxW, Math.round(H * 0.13), Math.round(H * 0.06), 3);
  head.lines.forEach((ln) => {
    parts.push(T(ln, pad, y + head.px, head.px, { fill: K.ink, weight: 800, tracking: -head.px * 0.022 }));
    y += Math.round(head.px * 1.12);
  });

  parts.push(`<rect x="${pad}" y="${y + Math.round(H * 0.03)}" width="${Math.round(W * 0.06)}" height="${Math.round(H * 0.012)}" rx="${Math.round(H * 0.006)}" fill="${K.accent}"/>`);

  if (spec.sub) {
    const sub = fit(spec.sub, boxW, Math.round(H * 0.042), Math.round(H * 0.026), 2, "regular");
    let sy = y + Math.round(H * 0.09);
    sub.lines.forEach((ln) => {
      parts.push(T(ln, pad, sy, sub.px, { fill: K.muted }));
      sy += Math.round(sub.px * 1.4);
    });
  }

  if (spec.footer) {
    parts.push(T(spec.footer, pad, H - Math.round(H * 0.07), Math.round(H * 0.032), { fill: K.muted, weight: 500 }));
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${parts.join("\n  ")}
</svg>`;
}

export async function renderCover(
  spec: CoverSpec,
  opts: { size?: CoverSize; theme?: AssetThemeName; scale?: 1 | 2 } = {}
): Promise<Buffer> {
  const scale = opts.scale ?? 2;
  const { width, height } = COVER_SIZES[opts.size ?? "featured"];
  return sharp(Buffer.from(coverSvg(spec, opts)), { density: 72 * scale })
    .resize(width * scale, height * scale)
    .png()
    .toBuffer();
}
