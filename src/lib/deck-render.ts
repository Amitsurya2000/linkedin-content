import sharp from "sharp";
import { ICONS, iconFor, pickPalette, type Palette } from "./deck-theme";
import { type KoyopoSlide, type SlideTemplate, type RawSlide, toKoyopoSlides } from "./koyopo";

/**
 * Editorial deck renderer — the multi-colour, illustrated style.
 *
 * Consumes the same slide objects as the KOYOPO renderer so both read the model's
 * output unchanged; only the visual language differs. Where KOYOPO is flat red
 * type on white, this draws coloured header bars, tinted cards with icons, bar
 * charts, numbered badges and progress rings.
 *
 * Still zero-cost: everything is SVG drawn here and rasterised by sharp. No image
 * API, no key. Photographs are the one thing this cannot do.
 */

export const DECK_CANVASES = {
  tall: { width: 1080, height: 1350, ptScale: 1080 / 620 },
  wide: { width: 2000, height: 1125, ptScale: 2000 / 960 },
} as const;

export type DeckCanvas = keyof typeof DECK_CANVASES;

const FONT = "Poppins";
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

/**
 * Type floors. Published 2026 carousel guidance puts the readable minimum on a
 * 1080px canvas at ~48px for headings and ~24px for body; below that, mobile
 * completion rate falls off. `fit` shrinks text to make it fit, so without a
 * floor a dense slide silently renders at an unreadable size. When copy will not
 * fit at the floor the right answer is another slide, not smaller type.
 */
const MIN_HEAD_PT = 28; // ~49px tall canvas, ~58px wide
const MIN_BODY_PT = 12; // ~21px tall canvas, ~25px wide

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

/** Shrink until the block fits both the line budget and the width. */
function fit(t: string, maxW: number, start: number, min: number, maxLines: number, w: keyof typeof GLYPH_W = "regular") {
  const step = Math.max(1, Math.round(start * 0.04));
  for (let px = start; px >= min; px -= step) {
    const lines = wrap(t, maxW, px, w);
    const widest = Math.max(...lines.map((l) => l.length), 0) * px * GLYPH_W[w];
    if (lines.length <= maxLines && widest <= maxW) return { px, lines };
  }
  return { px: min, lines: wrap(t, maxW, min, w).slice(0, maxLines) };
}

function T(s: string, x: number, y: number, px: number, o: { fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; italic?: boolean; tracking?: number } = {}): string {
  const { fill = "#111827", weight = 400, anchor = "start", italic = false, tracking = 0 } = o;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${px}" font-weight="${weight}"${italic ? ' font-style="italic"' : ""}${tracking ? ` letter-spacing="${tracking}"` : ""} fill="${fill}">${esc(s)}</text>`;
}

function splitItem(item: string): { prefix: string | null; rest: string } {
  const i = item.indexOf(" — ");
  if (i === -1 || i > 60) return { prefix: null, rest: item };
  return { prefix: item.slice(0, i), rest: item.slice(i + 3) };
}

export interface DeckOptions {
  canvas?: DeckCanvas;
  seed?: string;
  deckTitle?: string;
  author?: string;
  pageNumber?: number;
  pageTotal?: number;
}

export async function renderDeckSlide(slide: KoyopoSlide, opts: DeckOptions = {}): Promise<Buffer> {
  const canvas = opts.canvas ?? "tall";
  const { width: W, height: H, ptScale } = DECK_CANVASES[canvas];
  const pt = (n: number) => Math.round(n * ptScale);
  const { palette: P } = pickPalette(opts.seed ?? "default");

  const padX = Math.round(W * 0.075);
  const boxW = W - padX * 2;
  const parts: string[] = [];

  const isHero = slide.template === "title" || slide.template === "divider" || slide.template === "quote";

  if (isHero) {
    parts.push(...heroSlide(slide, { W, H, padX, boxW, pt, P }));
  } else {
    // Coloured top band + section tag is the shared chrome for content slides.
    const bandH = Math.round(H * 0.014);
    parts.push(`<rect x="0" y="0" width="${W}" height="${bandH}" fill="${P.primary}"/>`);

    let y = Math.round(H * 0.1);
    if (slide.sectionTag) {
      parts.push(`<rect x="${padX}" y="${y - pt(13)}" width="${pt(5)}" height="${pt(16)}" rx="${pt(2)}" fill="${P.accent}"/>`);
      parts.push(T(slide.sectionTag.toUpperCase().slice(0, 30), padX + pt(13), y, pt(11), { fill: P.primary, weight: 700, tracking: pt(11) * 0.14 }));
      y += pt(26);
    }

    const head = fit(slide.title ?? "", boxW, pt(34), pt(MIN_HEAD_PT), 3, "bold");
    head.lines.forEach((ln) => { parts.push(T(ln, padX, y + head.px, head.px, { fill: P.ink, weight: 800, tracking: -head.px * 0.02 })); y += Math.round(head.px * 1.16); });
    y += Math.round(head.px * 0.55);

    if (slide.subtitle) {
      const sub = fit(slide.subtitle, boxW, pt(15), pt(MIN_BODY_PT), 2);
      sub.lines.forEach((ln) => { parts.push(T(ln, padX, y + sub.px, sub.px, { fill: P.muted })); y += Math.round(sub.px * 1.35); });
      y += Math.round(sub.px * 0.5);
    }

    parts.push(...contentSlide(slide, { W, H, padX, boxW, y, pt, P }));
  }

  // Footer chrome — page counter and deck title, muted on light, tinted on dark.
  const onDark = isHero;
  const footPx = pt(9);
  if (opts.pageNumber && opts.pageTotal) {
    parts.push(T(`${opts.pageNumber} / ${opts.pageTotal}`, W - padX, H - Math.round(H * 0.045), footPx, {
      fill: onDark ? "rgba(255,255,255,0.75)" : P.muted, anchor: "end",
    }));
  }
  if (opts.deckTitle) {
    parts.push(T(opts.deckTitle, padX, H - Math.round(H * 0.045), footPx, { fill: onDark ? "rgba(255,255,255,0.75)" : P.muted }));
  }

  const bg = isHero ? P.deep : P.white;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${parts.join("\n  ")}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

type Ctx = { W: number; H: number; padX: number; boxW: number; pt: (n: number) => number; P: Palette };

/** Cover / divider / quote — full-bleed dark panel with a colour accent. */
function heroSlide(s: KoyopoSlide, ctx: Ctx & { pt: (n: number) => number }): string[] {
  const { W, H, padX, boxW, pt, P } = ctx;
  const out: string[] = [];

  // Large soft colour shapes for depth — the thing flat KOYOPO slides lack.
  out.push(`<circle cx="${W * 0.92}" cy="${H * 0.12}" r="${W * 0.3}" fill="${P.primary}" opacity="0.28"/>`);
  out.push(`<circle cx="${W * 0.08}" cy="${H * 0.93}" r="${W * 0.24}" fill="${P.accent}" opacity="0.2"/>`);

  if (s.template === "quote") {
    out.push(T("“", padX - pt(4), Math.round(H * 0.34), pt(120), { fill: P.accent, weight: 700 }));
    const q = fit(s.body ?? s.title ?? "", boxW, pt(38), pt(20), 6, "bold");
    let y = Math.round(H * 0.44);
    q.lines.forEach((ln) => { out.push(T(ln, padX, y, q.px, { fill: P.white, weight: 800, tracking: -q.px * 0.018 })); y += Math.round(q.px * 1.26); });
    if (s.subtitle) out.push(T(s.subtitle, padX, y + pt(14), pt(14), { fill: P.accent, italic: true }));
    return out;
  }

  const big = s.template === "title" ? pt(78) : pt(60);
  const t = fit(s.title ?? "", boxW, big, pt(30), 4, "bold");
  const lh = Math.round(t.px * 1.08);
  let y = Math.round(H * 0.5) - Math.round(((t.lines.length - 1) * lh) / 2);
  if (s.subtitle) y -= pt(20);
  t.lines.forEach((ln) => { out.push(T(ln, padX, y, t.px, { fill: P.white, weight: 900, tracking: -t.px * 0.022 })); y += lh; });

  // Accent rule under the title, a signature of this style.
  out.push(`<rect x="${padX}" y="${y + pt(6)}" width="${pt(56)}" height="${pt(6)}" rx="${pt(3)}" fill="${P.accent}"/>`);

  if (s.subtitle) {
    const sub = fit(s.subtitle, boxW, pt(17), pt(12), 3);
    let sy = y + pt(32);
    sub.lines.forEach((ln) => { out.push(T(ln, padX, sy, sub.px, { fill: "rgba(255,255,255,0.85)" })); sy += Math.round(sub.px * 1.35); });
  }
  return out;
}

function contentSlide(s: KoyopoSlide, ctx: Ctx & { y: number }): string[] {
  const { W, H, padX, boxW, pt, P } = ctx;
  let y = ctx.y;
  const availH = Math.round(H * 0.9) - y;
  const out: string[] = [];
  const bodyPx = pt(14);

  switch (s.template) {
    case "cardGrid": {
      const items = (s.items ?? []).slice(0, 4);
      if (!items.length) break;
      const cols = items.length >= 3 ? 2 : 1;
      const rows = Math.ceil(items.length / cols);
      const gap = pt(11);
      const cw = Math.floor((boxW - gap * (cols - 1)) / cols);
      const iconBlock = pt(20) + pt(26) + pt(22); // top pad + icon + gap to text

      // Size rows to the tallest card's actual content rather than dividing the
      // space evenly — equal division leaves short cards visibly half-empty.
      const measured = items.map((it) => {
        const { prefix, rest } = splitItem(it);
        const p = prefix ? fit(prefix, cw - pt(34), bodyPx, pt(MIN_BODY_PT), 2, "bold") : null;
        const b = fit(rest, cw - pt(34), bodyPx, pt(MIN_BODY_PT), 4);
        return iconBlock + (p ? p.lines.length * Math.round(p.px * 1.24) + pt(3) : 0)
          + b.lines.length * Math.round(b.px * 1.32) + pt(18);
      });
      const evenH = Math.floor((availH - gap * (rows - 1)) / rows);
      const ch = Math.min(evenH, Math.max(...measured));
      // Centre the (possibly shorter) grid in the space left below the heading.
      y += Math.round((availH - (ch * rows + gap * (rows - 1))) / 2);

      const swatch = [P.primary, P.accent, P.third, P.deep];
      items.forEach((it, i) => {
        const { prefix, rest } = splitItem(it);
        const x = padX + (i % cols) * (cw + gap);
        const cy = y + Math.floor(i / cols) * (ch + gap);
        const col = swatch[i % swatch.length];
        out.push(`<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="${pt(9)}" fill="${P.tint}"/>`);
        // Colour spine — cheap way to make a grid read as designed, not listed.
        out.push(`<rect x="${x}" y="${cy}" width="${pt(5)}" height="${ch}" rx="${pt(2)}" fill="${col}"/>`);
        const iconS = pt(26);
        out.push(`<circle cx="${x + pt(18) + iconS / 2}" cy="${cy + pt(20) + iconS / 2}" r="${iconS * 0.78}" fill="${col}" opacity="0.14"/>`);
        out.push(ICONS[iconFor(i)](x + pt(18), cy + pt(20), iconS, col));
        let ty = cy + pt(20) + iconS + pt(22);
        if (prefix) {
          const p = fit(prefix, cw - pt(34), bodyPx, pt(MIN_BODY_PT), 2, "bold");
          p.lines.forEach((ln) => { out.push(T(ln, x + pt(18), ty, p.px, { fill: P.ink, weight: 700 })); ty += Math.round(p.px * 1.24); });
          ty += pt(3);
        }
        const b = fit(rest, cw - pt(34), bodyPx, pt(MIN_BODY_PT), 4);
        b.lines.forEach((ln) => { out.push(T(ln, x + pt(18), ty, b.px, { fill: P.muted })); ty += Math.round(b.px * 1.32); });
      });
      break;
    }

    case "iconGrid": {
      // The "24 Ideas" menu layout: many short labelled tiles, 2-3 words each.
      const items = (s.items ?? []).slice(0, 9);
      if (!items.length) break;
      const cols = items.length > 4 ? 3 : 2;
      const rows = Math.ceil(items.length / cols);
      const gap = pt(9);
      const tw = Math.floor((boxW - gap * (cols - 1)) / cols);
      const th = Math.min(Math.floor((availH - gap * (rows - 1)) / rows), pt(96));
      y += Math.round((availH - (th * rows + gap * (rows - 1))) / 2);
      const swatch = [P.primary, P.accent, P.third, P.deep];
      items.forEach((it, i) => {
        const x = padX + (i % cols) * (tw + gap);
        const ty = y + Math.floor(i / cols) * (th + gap);
        const col = swatch[i % swatch.length];
        out.push(`<rect x="${x}" y="${ty}" width="${tw}" height="${th}" rx="${pt(8)}" fill="${P.tint}"/>`);
        const iconS = pt(22);
        out.push(ICONS[iconFor(i)](x + (tw - iconS) / 2, ty + pt(14), iconS, col));
        // Tiles hold a label, never a sentence — fit two short lines at most.
        const label = fit(it, tw - pt(14), pt(13), pt(MIN_BODY_PT), 2, "bold");
        let ly = ty + pt(14) + iconS + pt(18);
        label.lines.forEach((ln) => {
          out.push(T(ln, x + tw / 2, ly, label.px, { fill: P.ink, weight: 700, anchor: "middle" }));
          ly += Math.round(label.px * 1.22);
        });
      });
      break;
    }

    case "numbered":
    case "timeline": {
      const items = (s.items ?? []).slice(0, 5);
      const r0 = pt(17);
      const tw0 = boxW - (r0 * 2 + pt(14));

      // Step from the tallest item's real height, not availH/count. Dividing the
      // space evenly strands short items in large empty bands.
      const needed = Math.max(
        ...items.map((it) => {
          const { prefix, rest } = splitItem(it);
          const b = fit(rest, tw0, bodyPx, pt(MIN_BODY_PT), 3);
          return (prefix ? Math.round(pt(16) * 1.34) : 0) + b.lines.length * Math.round(b.px * 1.32) + pt(22);
        }),
        r0 * 2 + pt(10)
      );
      const step = Math.min(Math.floor(availH / Math.max(1, items.length)), needed);
      y += Math.round((availH - step * items.length) / 2);

      const swatch = [P.primary, P.accent, P.third, P.deep, P.primary];
      items.forEach((it, i) => {
        const { prefix, rest } = splitItem(it);
        const top = y + i * step;
        const r = pt(17);
        const col = swatch[i % swatch.length];
        // Numbered badge — the recurring device in the reference designs.
        out.push(`<circle cx="${padX + r}" cy="${top + r}" r="${r}" fill="${col}"/>`);
        out.push(T(String(i + 1), padX + r, top + r + pt(6), pt(16), { fill: P.white, weight: 700, anchor: "middle" }));
        if (s.template === "timeline" && i < items.length - 1) {
          out.push(`<rect x="${padX + r - 1}" y="${top + r * 2 + pt(4)}" width="2" height="${step - r * 2 - pt(8)}" fill="${P.tint}"/>`);
        }
        const tx = padX + r * 2 + pt(14);
        const tw = boxW - (r * 2 + pt(14));
        let ty = top + pt(14);
        if (prefix) {
          const p = fit(prefix, tw, pt(16), pt(MIN_BODY_PT), 1, "bold");
          out.push(T(p.lines[0] ?? prefix, tx, ty, p.px, { fill: P.ink, weight: 700 }));
          ty += Math.round(p.px * 1.34);
        }
        const b = fit(rest, tw, bodyPx, pt(MIN_BODY_PT), 3);
        b.lines.forEach((ln) => { out.push(T(ln, tx, ty, b.px, { fill: P.muted })); ty += Math.round(b.px * 1.32); });
      });
      break;
    }

    case "twoColumn": {
      const cols = (s.columns ?? []).slice(0, 2);
      if (!cols.length) break;
      const gap = pt(13);
      const cw = Math.floor((boxW - gap) / 2);
      // First column reads as the "before"/negative side, second as the "after".
      const tone = [{ c: P.muted, icon: "cross" }, { c: P.primary, icon: "check" }];

      // Panels share one height, sized to the longer column's real content — a
      // full-height panel under three short bullets reads as a layout mistake.
      const panelH = Math.min(
        availH,
        Math.max(
          ...cols.map((col) =>
            pt(58) + col.items.slice(0, 5).reduce((h, it) => {
              const b = fit(it, cw - pt(34), bodyPx, pt(MIN_BODY_PT), 3);
              return h + b.lines.length * Math.round(b.px * 1.3) + pt(8);
            }, 0) + pt(14)
          )
        )
      );

      cols.forEach((col, ci) => {
        const x = padX + ci * (cw + gap);
        const t = tone[ci % 2];
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${panelH}" rx="${pt(9)}" fill="${ci === 1 ? P.tint : "#F8FAFC"}"/>`);
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${pt(38)}" rx="${pt(9)}" fill="${ci === 1 ? P.primary : "#94A3B8"}"/>`);
        out.push(`<rect x="${x}" y="${y + pt(24)}" width="${cw}" height="${pt(14)}" fill="${ci === 1 ? P.primary : "#94A3B8"}"/>`);
        const h = fit(col.heading.toUpperCase().slice(0, 30), cw - pt(20), pt(12), pt(9), 1, "bold");
        out.push(T(h.lines[0] ?? col.heading, x + pt(12), y + pt(25), h.px, { fill: P.white, weight: 700, tracking: h.px * 0.1 }));
        let ty = y + pt(58);
        col.items.slice(0, 5).forEach((it) => {
          const s2 = pt(15);
          out.push(ICONS[t.icon](x + pt(11), ty - pt(11), s2, t.c));
          const b = fit(it, cw - pt(34), bodyPx, pt(MIN_BODY_PT), 3);
          b.lines.forEach((ln, li) => {
            out.push(T(ln, x + pt(32), ty, b.px, { fill: li === 0 ? P.ink : P.muted }));
            ty += Math.round(b.px * 1.3);
          });
          ty += pt(8);
        });
      });
      break;
    }

    case "bigStat": {
      // Stat card with a progress ring — far stronger than bare centred type.
      const cardH = Math.min(availH, Math.round(H * 0.42));
      out.push(`<rect x="${padX}" y="${y}" width="${boxW}" height="${cardH}" rx="${pt(12)}" fill="${P.tint}"/>`);
      const cx = padX + boxW / 2;
      const cy = y + cardH * 0.44;
      const r = Math.round(cardH * 0.3);
      const circ = 2 * Math.PI * r;
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${P.white}" stroke-width="${pt(9)}"/>`);
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${P.primary}" stroke-width="${pt(9)}" stroke-linecap="round" stroke-dasharray="${circ * 0.78} ${circ}" transform="rotate(-90 ${cx} ${cy})"/>`);
      const st = fit(s.stat ?? "", r * 1.7, pt(40), pt(16), 1, "bold");
      out.push(T(st.lines[0] ?? s.stat ?? "", cx, cy + st.px * 0.36, st.px, { fill: P.ink, weight: 900, tracking: -st.px * 0.03, anchor: "middle" }));
      if (s.statLabel) {
        out.push(T(s.statLabel.toUpperCase().slice(0, 30), cx, y + cardH - pt(20), pt(11), { fill: P.primary, weight: 700, anchor: "middle", tracking: pt(11) * 0.12 }));
      }
      if (s.body) {
        const b = fit(s.body, boxW, bodyPx, pt(MIN_BODY_PT), 3);
        let ty = y + cardH + pt(24);
        b.lines.forEach((ln) => { out.push(T(ln, padX + boxW / 2, ty, b.px, { fill: P.muted, anchor: "middle" })); ty += Math.round(b.px * 1.34); });
      }
      break;
    }

    case "worksheet": {
      const items = (s.items ?? []).slice(0, 5);
      const step = Math.floor(availH / Math.max(1, items.length));
      items.forEach((it, i) => {
        const top = y + i * step;
        out.push(`<rect x="${padX}" y="${top}" width="${boxW}" height="${step - pt(9)}" rx="${pt(8)}" fill="${i % 2 ? "#F8FAFC" : P.tint}"/>`);
        const s2 = pt(17);
        out.push(ICONS.check(padX + pt(13), top + pt(15), s2, P.primary));
        const b = fit(it, boxW - pt(48), bodyPx, pt(MIN_BODY_PT), 3);
        let ty = top + pt(28);
        b.lines.forEach((ln) => { out.push(T(ln, padX + pt(40), ty, b.px, { fill: P.ink })); ty += Math.round(b.px * 1.3); });
      });
      break;
    }

    case "templateCard": {
      out.push(`<rect x="${padX}" y="${y}" width="${boxW}" height="${availH}" rx="${pt(11)}" fill="${P.tint}"/>`);
      out.push(`<rect x="${padX}" y="${y}" width="${boxW}" height="${pt(6)}" rx="${pt(3)}" fill="${P.primary}"/>`);
      let ty = y + pt(34);
      for (const raw of (s.body ?? "").split("\n")) {
        const b = /^\*\*(.+)\*\*$/.exec(raw.trim());
        const content = b ? b[1] : raw;
        if (!content.trim()) continue;
        const f = fit(content, boxW - pt(40), bodyPx, pt(MIN_BODY_PT), 4, b ? "bold" : "regular");
        f.lines.forEach((ln) => {
          out.push(T(ln, padX + pt(20), ty, f.px, { fill: b ? P.ink : P.muted, weight: b ? 700 : 400 }));
          ty += Math.round(f.px * 1.4);
        });
        ty += pt(5);
      }
      break;
    }
  }
  return out;
}

/** Render every slide, stamping page numbers. */
export async function renderEditorialDeck(slides: KoyopoSlide[], opts: DeckOptions = {}): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (let i = 0; i < slides.length; i++) {
    out.push(await renderDeckSlide(slides[i], { ...opts, pageNumber: i + 1, pageTotal: slides.length }));
  }
  return out;
}

export { toKoyopoSlides, type RawSlide, type KoyopoSlide, type SlideTemplate };
