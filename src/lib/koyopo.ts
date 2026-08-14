import sharp from "sharp";

/**
 * KOYOPO / 1Cr+ CAREER OS slide renderer.
 *
 * Draws flat-colour slides directly — no AI background, no image API, no key.
 * That is the whole point of the design system: red and white are exact colours,
 * so generating them is free and deterministic, unlike the image-model-backed
 * `composeSlide` path in compose.ts which paints a photographic background first.
 *
 * Text is drawn as real Poppins glyphs via librsvg inside sharp, so the font must
 * be installed on the host. It is NOT bundled at runtime: librsvg on Windows
 * resolves through the OS font stack and ignores fontconfig, so shipping the TTFs
 * in assets/fonts alone is not enough — they have to be installed. See
 * assets/fonts/README.md.
 */

// ─── Design tokens — the only colours the system allows ──────────────────────
export const KOYOPO = {
  red: "#ED383B",
  ink: "#1A1A1A",
  muted: "#6B6B6B",
  white: "#FFFFFF",
  cardFill: "#FCEBEC",
  cardBorder: "#F5C5C7",
} as const;

const FONT = "Poppins";

/**
 * Canvas presets. The spec is authored for a 13.33x7.5in deck (16:9), which is
 * `wide`. `tall` is the 4:5 portrait LinkedIn actually favours — it occupies more
 * vertical feed space, so carousels in that ratio get more dwell time.
 *
 * `ptScale` converts the spec's point sizes to pixels. Wide maps 13.33in to its
 * pixel width (150 DPI). Tall is a narrower canvas, so type is scaled against a
 * smaller reference width to keep the same optical weight rather than shrinking.
 */
export const CANVASES = {
  wide: { width: 2000, height: 1125, ptScale: 2000 / 960 },
  tall: { width: 1080, height: 1350, ptScale: 1080 / 620 },
} as const;

export type CanvasName = keyof typeof CANVASES;

export type SlideTemplate =
  | "title" | "divider" | "quote"
  | "cardGrid" | "numbered" | "worksheet"
  | "twoColumn" | "bigStat" | "templateCard" | "timeline"
  /** 6-9 short labelled tiles — the "24 Ideas" menu layout. */
  | "iconGrid";

/** Red-background templates. Everything else renders on white. */
const RED_TEMPLATES = new Set<SlideTemplate>(["title", "divider", "quote"]);

export interface KoyopoSlide {
  template: SlideTemplate;
  title?: string;
  subtitle?: string;
  body?: string;
  /** cardGrid / numbered / timeline / worksheet items, "Concept — expansion." */
  items?: string[];
  /** twoColumn only */
  columns?: { heading: string; items: string[] }[];
  /** bigStat only */
  stat?: string;
  statLabel?: string;
  sectionTag?: string;
  moduleTag?: string;
}

export interface RenderOptions {
  canvas?: CanvasName;
  deckTitle?: string;
  pageNumber?: number;
  pageTotal?: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * Poppins advance widths, as a fraction of font size. Measured empirically from
 * the rendered face rather than guessed: bold is fractionally wider than regular.
 * Used only to decide line breaks — librsvg does the real shaping.
 */
const GLYPH_W = { regular: 0.545, bold: 0.575 } as const;

function wrap(text: string, maxWidthPx: number, fontPx: number, weight: keyof typeof GLYPH_W = "regular"): string[] {
  const per = fontPx * GLYPH_W[weight];
  const maxChars = Math.max(4, Math.floor(maxWidthPx / per));
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = w;
      else if ((line + " " + w).length <= maxChars) line += " " + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.filter((l) => l.length > 0);
}

/**
 * Shrink until the wrapped block fits `maxLines` AND every individual line fits
 * the width.
 *
 * The width check is not redundant: `wrap` cannot break inside a word, so a long
 * unbroken token ("LangGraph", "Production") is emitted as its own over-wide line.
 * Testing line count alone accepts that and the glyphs run off the canvas edge —
 * silently, because SVG does not clip by default.
 */
function fit(text: string, maxWidthPx: number, startPx: number, minPx: number, maxLines: number, weight: keyof typeof GLYPH_W = "regular") {
  const step = Math.max(1, Math.round(startPx * 0.04));
  for (let px = startPx; px >= minPx; px -= step) {
    const lines = wrap(text, maxWidthPx, px, weight);
    const widest = Math.max(...lines.map((l) => l.length)) * px * GLYPH_W[weight];
    if (lines.length <= maxLines && widest <= maxWidthPx) return { px, lines };
  }
  return { px: minPx, lines: wrap(text, maxWidthPx, minPx, weight).slice(0, maxLines) };
}

function text(
  s: string, x: number, y: number, px: number,
  opts: { fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; italic?: boolean; tracking?: number } = {}
): string {
  const { fill = KOYOPO.ink, weight = 400, anchor = "start", italic = false, tracking = 0 } = opts;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${px}" font-weight="${weight}"${
    italic ? ' font-style="italic"' : ""}${tracking ? ` letter-spacing="${tracking}"` : ""} fill="${fill}">${esc(s)}</text>`;
}

/**
 * Splits "Concept Name — expansion." at the spec's em dash. The prefix renders
 * bold red, the rest regular ink. Falls back to plain text when the separator is
 * missing or lands past the 60-character budget the spec sets, rather than
 * bolding half a sentence.
 */
function splitItem(item: string): { prefix: string | null; rest: string } {
  const i = item.indexOf(" — ");
  if (i === -1 || i > 60) return { prefix: null, rest: item };
  return { prefix: item.slice(0, i), rest: item.slice(i + 3) };
}

export async function renderSlide(slide: KoyopoSlide, opts: RenderOptions = {}): Promise<Buffer> {
  const canvasName: CanvasName = opts.canvas ?? "tall";
  const { width: W, height: H, ptScale } = CANVASES[canvasName];
  const pt = (n: number) => Math.round(n * ptScale);

  const onRed = RED_TEMPLATES.has(slide.template);
  const bg = onRed ? KOYOPO.red : KOYOPO.white;
  const fg = onRed ? KOYOPO.white : KOYOPO.ink;
  const sub = onRed ? KOYOPO.white : KOYOPO.muted;

  const padX = Math.round(W * 0.075);
  const boxW = W - padX * 2;
  const parts: string[] = [];

  // ── Corner slots: section tag TL, page counter TR, module tag BL, deck BR ──
  const tagPx = pt(11);
  const footPx = pt(9);
  const topY = Math.round(H * 0.06);
  const botY = H - Math.round(H * 0.045);

  if (slide.sectionTag) {
    parts.push(text(slide.sectionTag.toUpperCase().slice(0, 30), padX, topY, tagPx, {
      fill: onRed ? KOYOPO.white : KOYOPO.red, weight: 700, tracking: tagPx * 0.14,
    }));
  }
  if (opts.pageNumber && opts.pageTotal) {
    parts.push(text(`${opts.pageNumber} / ${opts.pageTotal}`, W - padX, topY, footPx, {
      fill: sub, weight: 400, anchor: "end",
    }));
  }
  if (slide.moduleTag) {
    parts.push(text(slide.moduleTag, padX, botY, footPx, { fill: sub }));
  }
  if (opts.deckTitle) {
    parts.push(text(opts.deckTitle, W - padX, botY, footPx, { fill: sub, anchor: "end" }));
  }

  const midY = Math.round(H * 0.5);

  switch (slide.template) {
    case "title": {
      const t = fit(slide.title ?? "", boxW, pt(110), pt(44), 3, "bold");
      const lh = Math.round(t.px * 1.06);
      let y = midY - Math.round(((t.lines.length - 1) * lh) / 2);
      if (slide.subtitle) y -= Math.round(t.px * 0.35);
      t.lines.forEach((ln) => { parts.push(text(ln, padX, y, t.px, { fill: fg, weight: 700 })); y += lh; });
      if (slide.subtitle) {
        parts.push(text(slide.subtitle, padX, y + Math.round(t.px * 0.25), pt(16), { fill: fg, italic: true }));
      }
      break;
    }

    case "divider": {
      const t = fit(slide.title ?? "", boxW, pt(78), pt(34), 2, "bold");
      const lh = Math.round(t.px * 1.08);
      let y = midY - Math.round(((t.lines.length - 1) * lh) / 2);
      t.lines.forEach((ln) => { parts.push(text(ln, padX, y, t.px, { fill: fg, weight: 700 })); y += lh; });
      break;
    }

    case "quote": {
      const q = slide.body ?? slide.title ?? "";
      const t = fit(q, boxW, pt(42), pt(22), 6, "bold");
      const lh = Math.round(t.px * 1.24);
      let y = midY - Math.round(((t.lines.length - 1) * lh) / 2);
      // Accent circle, the spec's one decorative element on red slides.
      parts.push(`<circle cx="${padX + pt(10)}" cy="${y - t.px * 1.5}" r="${pt(10)}" fill="${KOYOPO.white}" opacity="0.28"/>`);
      t.lines.forEach((ln) => { parts.push(text(ln, padX, y, t.px, { fill: fg, weight: 700 })); y += lh; });
      if (slide.subtitle) {
        parts.push(text(slide.subtitle, padX, y + Math.round(t.px * 0.5), pt(15), { fill: fg, italic: true }));
      }
      break;
    }

    default: {
      // Every white template shares the same heading block, then diverges.
      const headPx = pt(36);
      const head = fit(slide.title ?? "", boxW, headPx, pt(20), 3, "bold");
      let y = Math.round(H * 0.17);
      const hlh = Math.round(head.px * 1.14);
      head.lines.forEach((ln) => { parts.push(text(ln, padX, y, head.px, { fill: KOYOPO.ink, weight: 700 })); y += hlh; });

      if (slide.subtitle) {
        y += Math.round(pt(16) * 0.4);
        parts.push(text(slide.subtitle, padX, y, pt(15), { fill: KOYOPO.muted, italic: true }));
        y += Math.round(pt(15) * 1.6);
      }
      y += Math.round(H * 0.03);

      parts.push(...renderWhiteBody(slide, { W, H, padX, boxW, y, pt }));
    }
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${parts.join("\n  ")}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Body renderers for the seven white templates. */
function renderWhiteBody(
  slide: KoyopoSlide,
  ctx: { W: number; H: number; padX: number; boxW: number; y: number; pt: (n: number) => number }
): string[] {
  const { W, H, padX, boxW, pt } = ctx;
  let y = ctx.y;
  const out: string[] = [];
  const bodyPx = pt(15);
  const availH = Math.round(H * 0.88) - y;

  /**
   * A pink card with the bold-red prefix treatment from the spec.
   *
   * Grid cards all share one height so the grid stays even, but the text inside
   * is usually much shorter than that — so measure the block first and centre it
   * vertically. Drawing straight from the top leaves each card visibly bottom-
   * heavy with dead space.
   */
  const card = (item: string, top: number, h: number, x: number, w: number) => {
    const { prefix, rest } = splitItem(item);
    const inner = w - pt(18) * 2;
    const r: string[] = [
      `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${pt(6)}" fill="${KOYOPO.cardFill}" stroke="${KOYOPO.cardBorder}" stroke-width="1"/>`,
    ];

    const p = prefix ? fit(prefix, inner, bodyPx, pt(11), 2, "bold") : null;
    const b = fit(rest, inner, bodyPx, pt(10), 5);
    const pLead = p ? Math.round(p.px * 1.25) : 0;
    const bLead = Math.round(b.px * 1.35);
    const contentH = (p ? p.lines.length * pLead + Math.round(bodyPx * 0.15) : 0) + b.lines.length * bLead;

    // Start on the first baseline of a vertically centred block.
    let ty = top + Math.round((h - contentH) / 2) + Math.round((p ? p.px : b.px) * 0.85);
    if (p) {
      p.lines.forEach((ln) => { r.push(text(ln, x + pt(18), ty, p.px, { fill: KOYOPO.red, weight: 700 })); ty += pLead; });
      ty += Math.round(bodyPx * 0.15);
    }
    b.lines.forEach((ln) => { r.push(text(ln, x + pt(18), ty, b.px, { fill: KOYOPO.ink })); ty += bLead; });
    return r;
  };

  switch (slide.template) {
    case "cardGrid": {
      const items = (slide.items ?? []).slice(0, 4);
      if (!items.length) break;
      const cols = items.length >= 3 ? 2 : 1;
      const rows = Math.ceil(items.length / cols);
      const gap = pt(12);
      const cw = Math.floor((boxW - gap * (cols - 1)) / cols);
      const ch = Math.floor((availH - gap * (rows - 1)) / rows);
      items.forEach((it, i) => {
        const cx = padX + (i % cols) * (cw + gap);
        const cy = y + Math.floor(i / cols) * (ch + gap);
        out.push(...card(it, cy, ch, cx, cw));
      });
      break;
    }

    case "numbered": {
      const items = (slide.items ?? []).slice(0, 5);
      const step = Math.floor(availH / Math.max(1, items.length));
      items.forEach((it, i) => {
        const { prefix, rest } = splitItem(it);
        const top = y + i * step;
        const numPx = pt(22);
        out.push(text(String(i + 1).padStart(2, "0"), padX, top + numPx, numPx, { fill: KOYOPO.red, weight: 700 }));
        const tx = padX + pt(38);
        const inner = boxW - pt(38);
        let ty = top + numPx;
        if (prefix) {
          out.push(text(prefix, tx, ty, bodyPx, { fill: KOYOPO.red, weight: 700 }));
          ty += Math.round(bodyPx * 1.3);
        }
        const b = fit(rest, inner, bodyPx, pt(10), 3);
        b.lines.forEach((ln) => { out.push(text(ln, tx, ty, b.px, { fill: KOYOPO.ink })); ty += Math.round(b.px * 1.3); });
      });
      break;
    }

    case "timeline": {
      const items = (slide.items ?? []).slice(0, 5);
      const step = Math.floor(availH / Math.max(1, items.length));
      const railX = padX + pt(7);
      out.push(`<rect x="${railX - 1}" y="${y}" width="2" height="${step * items.length - step * 0.4}" fill="${KOYOPO.cardBorder}"/>`);
      items.forEach((it, i) => {
        const { prefix, rest } = splitItem(it);
        const top = y + i * step;
        out.push(`<circle cx="${railX}" cy="${top + pt(6)}" r="${pt(6)}" fill="${KOYOPO.red}"/>`);
        const tx = padX + pt(24);
        let ty = top + pt(11);
        if (prefix) { out.push(text(prefix, tx, ty, bodyPx, { fill: KOYOPO.red, weight: 700 })); ty += Math.round(bodyPx * 1.3); }
        const b = fit(rest, boxW - pt(24), bodyPx, pt(10), 3);
        b.lines.forEach((ln) => { out.push(text(ln, tx, ty, b.px, { fill: KOYOPO.ink })); ty += Math.round(b.px * 1.3); });
      });
      break;
    }

    case "worksheet": {
      const items = (slide.items ?? []).slice(0, 5);
      const step = Math.floor(availH / Math.max(1, items.length));
      items.forEach((it, i) => {
        const top = y + i * step;
        const q = fit(it, boxW, bodyPx, pt(10), 2);
        let ty = top + bodyPx;
        q.lines.forEach((ln) => { out.push(text(ln, padX, ty, q.px, { fill: KOYOPO.ink })); ty += Math.round(q.px * 1.3); });
        // Ruled answer line — the reader fills this in.
        out.push(`<rect x="${padX}" y="${ty + pt(8)}" width="${boxW}" height="1" fill="${KOYOPO.cardBorder}"/>`);
      });
      break;
    }

    case "twoColumn": {
      const cols = (slide.columns ?? []).slice(0, 2);
      if (!cols.length) break;
      const gap = pt(16);
      const cw = Math.floor((boxW - gap) / 2);
      cols.forEach((col, ci) => {
        const cx = padX + ci * (cw + gap);
        let ty = y + pt(16);
        out.push(text(col.heading.toUpperCase().slice(0, 30), cx, ty, pt(12), {
          fill: KOYOPO.red, weight: 700, tracking: pt(12) * 0.12,
        }));
        ty += Math.round(pt(12) * 2.2);
        col.items.slice(0, 5).forEach((it) => {
          const b = fit(it, cw - pt(14), bodyPx, pt(10), 3);
          b.lines.forEach((ln, li) => {
            out.push(text(li === 0 ? `— ${ln}` : `   ${ln}`, cx, ty, b.px, { fill: KOYOPO.ink }));
            ty += Math.round(b.px * 1.3);
          });
          ty += Math.round(bodyPx * 0.5);
        });
      });
      break;
    }

    case "bigStat": {
      const statPx = pt(96);
      const cy = y + Math.round(availH * 0.42);
      out.push(text(slide.stat ?? "", W / 2, cy, statPx, { fill: KOYOPO.red, weight: 700, anchor: "middle" }));
      if (slide.statLabel) {
        out.push(text(slide.statLabel.toUpperCase().slice(0, 30), W / 2, cy + Math.round(statPx * 0.55), pt(12), {
          fill: KOYOPO.muted, weight: 700, anchor: "middle", tracking: pt(12) * 0.14,
        }));
      }
      if (slide.body) {
        const b = fit(slide.body, boxW, bodyPx, pt(10), 3);
        let ty = cy + Math.round(statPx * 0.95);
        b.lines.forEach((ln) => { out.push(text(ln, W / 2, ty, b.px, { fill: KOYOPO.ink, anchor: "middle" })); ty += Math.round(b.px * 1.35); });
      }
      break;
    }

    case "templateCard": {
      const body = slide.body ?? "";
      out.push(`<rect x="${padX}" y="${y}" width="${boxW}" height="${availH}" rx="${pt(6)}" fill="${KOYOPO.cardFill}" stroke="${KOYOPO.cardBorder}" stroke-width="1"/>`);
      // **bold** is legal only here, per the spec. Emit each segment as its own
      // line rather than inline tspans so wrapping stays predictable.
      let ty = y + pt(30);
      for (const raw of body.split("\n")) {
        const bold = /^\*\*(.+)\*\*$/.exec(raw.trim());
        const content = bold ? bold[1] : raw;
        const b = fit(content, boxW - pt(24) * 2, bodyPx, pt(10), 4, bold ? "bold" : "regular");
        b.lines.forEach((ln) => {
          out.push(text(ln, padX + pt(24), ty, b.px, { fill: KOYOPO.ink, weight: bold ? 700 : 400 }));
          ty += Math.round(b.px * 1.4);
        });
      }
      break;
    }
  }

  return out;
}

const VALID_TEMPLATES = new Set<SlideTemplate>([
  "title", "divider", "quote", "cardGrid", "numbered",
  "worksheet", "twoColumn", "bigStat", "templateCard", "timeline", "iconGrid",
]);
/** Templates whose body is a list of "Concept — expansion." lines. */
const ITEM_TEMPLATES = new Set<SlideTemplate>(["cardGrid", "numbered", "timeline", "worksheet", "iconGrid"]);

export interface RawSlide {
  slideNumber?: number;
  title?: string;
  body?: string;
  slideTemplate?: string;
  sectionTag?: string;
  /**
   * One-line "so what" for the slide. The swipe renderer prints it in a tinted
   * card under the body — it is the element that makes a deck skimmable, so the
   * generator is asked for it on every content slide.
   */
  takeaway?: string;
  subtitle?: string;
}

/**
 * Map the model's slide JSON onto the renderer's shape.
 *
 * Gemini returns every slide's content as one `body` string, but `bigStat` and
 * `twoColumn` need structured fields — without this they render as an empty
 * slide, silently. Shared by the API route and scripts/koyopo-from-db.ts so the
 * two cannot drift apart.
 */
export function toKoyopoSlides(raw: RawSlide[]): KoyopoSlide[] {
  return raw.map((s, i) => {
    const named = s.slideTemplate?.trim() as SlideTemplate | undefined;
    const template: SlideTemplate =
      named && VALID_TEMPLATES.has(named)
        ? named
        : i === 0 ? "title" : i === raw.length - 1 ? "divider" : "cardGrid";

    const base: KoyopoSlide = { template, title: s.title, sectionTag: s.sectionTag };
    // Carried for every template; hero slides overwrite it with their body below.
    const takeaway = (s.takeaway ?? s.subtitle)?.trim();
    if (takeaway) base.subtitle = takeaway;
    const body = (s.body ?? "").trim();
    if (!body) return base;

    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

    if (ITEM_TEMPLATES.has(template)) {
      const cleaned = lines.map((l) => l.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "")).filter(Boolean);
      const limit = template === "cardGrid" ? 4 : template === "iconGrid" ? 9 : 5;
      base.items = (cleaned.length > 1 ? cleaned : body.split(/(?<=\.)\s+/).filter(Boolean)).slice(0, limit);
      return base;
    }

    if (template === "bigStat") {
      // First bare line is the headline figure; anything after it is supporting copy.
      base.stat = lines[0];
      // Only borrow the section tag as the stat label when there is no second
      // line to use — otherwise the same words print twice on one slide.
      base.statLabel = lines.length > 1 ? lines[1] : s.sectionTag;
      if (lines.length > 2) base.body = lines.slice(2).join(" ");
      return base;
    }

    if (template === "twoColumn") {
      // Lines starting with a bullet belong to the heading above them.
      const cols: { heading: string; items: string[] }[] = [];
      for (const l of lines) {
        if (/^[-•*]\s*/.test(l)) cols[cols.length - 1]?.items.push(l.replace(/^[-•*]\s*/, ""));
        else cols.push({ heading: l, items: [] });
      }
      const usable = cols.filter((c) => c.items.length);
      if (usable.length >= 2) { base.columns = usable.slice(0, 2); return base; }
      // No bullets to group by — fall back rather than render an empty slide.
      base.template = "cardGrid";
      base.items = lines.slice(0, 4);
      return base;
    }

    if (template === "title" || template === "divider") {
      base.subtitle = body;
      return base;
    }

    base.body = body;
    return base;
  });
}

/** Render a whole deck. Page numbers and the deck title are stamped per slide. */
export async function renderDeck(slides: KoyopoSlide[], opts: RenderOptions = {}): Promise<Buffer[]> {
  const total = slides.length;
  const out: Buffer[] = [];
  for (let i = 0; i < total; i++) {
    out.push(await renderSlide(slides[i], { ...opts, pageNumber: i + 1, pageTotal: total }));
  }
  return out;
}
