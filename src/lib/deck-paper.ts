import sharp from "sharp";
import type { KoyopoSlide } from "./koyopo";

/**
 * "Paper" — the editorial-diagram deck.
 *
 * Modelled on the reference decks the client supplied: a warm paper ground, a
 * large transitional serif for the cover, one or two short sans lines of copy
 * per slide, and then a HAND-DRAWN-LOOKING DIAGRAM occupying most of the page.
 *
 * The diagram is the point. Every other style in this app lays out text and
 * optionally places a picture; those reference decks carry almost no copy —
 * three lines and a drawing — and the drawing is what makes them readable in a
 * feed at thumbnail size. So this renderer has a diagram vocabulary rather than
 * a card system, and each slide is assigned one by template and by index, the
 * same way hook archetypes are assigned in the copy generator: naming the shape
 * beats hoping for variety.
 *
 * Seven diagram kinds, each drawn from the slide's own items so the picture says
 * what the slide says rather than decorating it:
 *
 *   scatter    a field of dots with one picked out — volume, and the one that
 *              mattered. Used for a statistic.
 *   branches   one origin fanning into labelled curves — a single thing that
 *              leads to several. Used for grids and lists of facets.
 *   pins       italic quotes on leader lines — objections, verbatim.
 *   timeline   five day-boxes with drop lines — a week, a sequence, a cadence.
 *   worksheet  numbered prompts over ruled blank lines — something to fill in.
 *   waves      stacked labelled waves — parallel streams of the same kind.
 *   statement  centred short lines with one italic counterpoint — the turn.
 */

const W = 1080;
const H = 1350;

const C = {
  paper: "#E9E9E6",
  ink: "#191914",
  body: "#33332C",
  muted: "#75756B",
  rule: "#C7C7C0",
  amber: "#A9863F",
  red: "#A3423A",
  green: "#6F8A5C",
  blue: "#556B94",
  lime: "#C3DC2B",
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Poppins, 'Segoe UI', Arial, sans-serif";

/** Average glyph width as a fraction of font size, per face and weight. */
const GW = { serif: 0.5, serifBold: 0.53, sans: 0.545, sansBold: 0.575 };

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

/** Shrink until the block fits the line budget. */
function fit(text: string, maxWidth: number, start: number, min: number, maxLines: number, gw: number) {
  let size = start;
  let lines = wrap(text, maxWidth, size, gw);
  while (lines.length > maxLines && size > min) {
    size -= 2;
    lines = wrap(text, maxWidth, size, gw);
  }
  return { size, lines: lines.slice(0, maxLines) };
}

/** Deterministic PRNG so a re-render of the same deck is pixel-identical. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

/**
 * "Concept — expansion." → just the concept, which is all a label has room for.
 *
 * `keepStop` matters more than it looks: a diagram LABEL reads better without a
 * full stop, but a slide's closing SENTENCE needs one. Stripping both turned
 * "It isn't." into "It isn't".
 */
function head(item: string, keepStop = false): string {
  const i = item.indexOf(" — ");
  const t = i > -1 && i < 60 ? item.slice(0, i) : item;
  return keepStop ? t : t.replace(/\.$/, "");
}

// ── diagrams ─────────────────────────────────────────────────────────────────

function dScatter(seed: string): string {
  const r = rng(seed);
  const cx = W / 2, cy = 760, spread = 250;
  let out = "";
  // One dot is lime and slightly off-centre: the point is "all this volume, and
  // one of them was the one that worked."
  const pick = 11;
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * spread;
    const x = cx + Math.cos(a) * d * 1.25;
    const y = cy + Math.sin(a) * d;
    const rad = 5 + r() * 13;
    out += i === pick
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${C.lime}"/>`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${C.ink}" opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`;
  }
  return out;
}

function dBranches(items: string[]): string {
  const labels = items.slice(0, 4).map((x) => head(x));
  if (!labels.length) return "";
  const ox = 210, oy = 790;
  const cols = [C.amber, C.green, C.blue, C.red];
  let out = `<circle cx="${ox}" cy="${oy}" r="8" fill="${C.ink}"/>`;
  const span = 150;
  const top = oy - ((labels.length - 1) * span) / 2;
  labels.forEach((l, i) => {
    const ey = top + i * span;
    const ex = 700;
    // A slow S-curve reads as drawn rather than plotted.
    out += `<path d="M ${ox} ${oy} C ${ox + 200} ${oy}, ${ex - 220} ${ey}, ${ex} ${ey}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="2.4" stroke-linecap="round"/>`;
    const t = fit(l, 300, 32, 22, 2, GW.serif);
    t.lines.forEach((line, k) =>
      out += `<text x="${ex + 22}" y="${ey + 10 + k * (t.size + 6)}" font-family="${SERIF}" font-style="italic" font-size="${t.size}" fill="${C.ink}">${esc(line)}</text>`);
  });
  return out;
}

function dPins(items: string[], punch?: string): string {
  const quotes = items.slice(0, 4).map((x) => head(x));
  if (!quotes.length) return "";
  let out = "";
  let y = 620;
  quotes.forEach((q, i) => {
    const x = 250 + (i % 2) * 90;
    const t = fit(`"${q}"`, 430, 34, 24, 2, GW.serif);
    // The leader line points back at nothing in particular — it is what makes
    // these read as annotations on a page rather than a bulleted list.
    out += `<path d="M ${x - 34} ${y + 26} L ${x - 8} ${y - 6}" stroke="${C.red}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
    t.lines.forEach((line, k) =>
      out += `<text x="${x}" y="${y + k * (t.size + 8)}" font-family="${SERIF}" font-style="italic" font-size="${t.size}" fill="${C.ink}">${esc(line)}</text>`);
    y += 130;
  });
  if (punch) {
    const p = fit(head(punch, true), 440, 36, 24, 2, GW.sans);
    p.lines.forEach((line, k) =>
      out += `<text x="${W - 96}" y="${y + 40 + k * (p.size + 8)}" text-anchor="end" font-family="${SANS}" font-size="${p.size}" font-weight="600" fill="${C.ink}">${esc(line)}</text>`);
  }
  return out;
}

function dTimeline(items: string[]): string {
  const labels = items.slice(0, 5).map((x) => head(x));
  if (!labels.length) return "";
  const days = ["M", "T", "W", "T", "F"].slice(0, labels.length);
  const boxW = 88, boxH = 56;
  const gap = (W - 192 - boxW) / Math.max(1, days.length - 1);
  const y = 600;
  let out = "";
  days.forEach((d, i) => {
    const x = 100 + i * gap;
    out += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" fill="none" stroke="${C.ink}" stroke-width="1.6"/>`;
    out += `<text x="${x + boxW / 2}" y="${y + 38}" text-anchor="middle" font-family="${SANS}" font-size="24" font-weight="600" fill="${C.ink}">${d}</text>`;
    // Alternating drop depth keeps five labels from colliding.
    const drop = 78 + (i % 2) * 96;
    out += `<path d="M ${x + boxW / 2} ${y + boxH} L ${x + boxW / 2} ${y + boxH + drop}" stroke="${C.amber}" stroke-width="1.6"/>`;
    const t = fit(labels[i], 200, 25, 18, 3, GW.sans);
    t.lines.forEach((line, k) =>
      out += `<text x="${x + boxW / 2}" y="${y + boxH + drop + 26 + k * (t.size + 5)}" text-anchor="middle" font-family="${SANS}" font-size="${t.size}" fill="${C.body}">${esc(line)}</text>`);
  });
  return out;
}

function dWorksheet(items: string[]): string {
  const prompts = items.slice(0, 4).map((x) => head(x));
  if (!prompts.length) return "";
  let out = "";
  let y = 470;
  prompts.forEach((p, i) => {
    const t = fit(p, 800, 30, 22, 2, GW.serif);
    out += `<text x="112" y="${y}" font-family="${SERIF}" font-style="italic" font-size="${t.size}" fill="${C.ink}">${esc(`${i + 1}.`)}</text>`;
    t.lines.forEach((line, k) =>
      out += `<text x="164" y="${y + k * (t.size + 6)}" font-family="${SERIF}" font-style="italic" font-size="${t.size}" fill="${C.ink}">${esc(line)}</text>`);
    // Two ruled columns of blank lines — the slide asks to be filled in, which
    // is what makes this shape get saved rather than scrolled past.
    const base = y + t.lines.length * (t.size + 6) + 18;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 2; col++) {
        const ry = base + row * 34;
        const rx = 152 + col * 414;
        out += `<path d="M ${rx} ${ry} L ${rx + 366} ${ry}" stroke="${C.rule}" stroke-width="1.5"/>`;
      }
    y = base + 150;
  });
  return out;
}

function dWaves(items: string[]): string {
  const labels = items.slice(0, 3).map((x) => head(x));
  if (!labels.length) return "";
  const cols = [C.ink, C.red, C.green];
  let out = "";
  const top = 600;
  labels.forEach((l, i) => {
    const y = top + i * 175;
    const t = fit(l, 700, 28, 20, 1, GW.sans);
    out += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="${t.size}" fill="${C.ink}">${esc(t.lines[0] ?? l)}</text>`;
    // One period of a sine, sampled — a smooth path reads as drawn by hand.
    const pts: string[] = [];
    for (let x = 0; x <= 40; x++) {
      const px = 190 + (x / 40) * 700;
      const py = y + 62 + Math.sin((x / 40) * Math.PI * 2 + i) * 22;
      pts.push(`${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    out += `<path d="M ${pts.join(" L ")}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="2.2" stroke-linecap="round"/>`;
  });
  return out;
}

function dStatement(items: string[], turn?: string): string {
  const lines = items.slice(0, 3);
  let out = "";
  let y = 620;
  lines.forEach((l) => {
    const t = fit(head(l, true), 820, 42, 28, 2, GW.sans);
    t.lines.forEach((line, k) =>
      out += `<text x="${W / 2}" y="${y + k * (t.size + 8)}" text-anchor="middle" font-family="${SANS}" font-size="${t.size}" fill="${C.ink}">${esc(line)}</text>`);
    y += t.lines.length * (t.size + 8) + 26;
  });
  if (turn) {
    const t = fit(head(turn, true), 780, 50, 32, 2, GW.serif);
    t.lines.forEach((line, k) =>
      out += `<text x="${W / 2}" y="${y + 40 + k * (t.size + 8)}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="${t.size}" fill="${C.red}">${esc(line)}</text>`);
  }
  return out;
}

/** The faint multi-line wave that signs the cover. */
function coverWave(): string {
  const cols = [C.rule, C.amber, C.red];
  let out = "";
  cols.forEach((c, i) => {
    const pts: string[] = [];
    for (let x = 0; x <= 60; x++) {
      const px = -40 + (x / 60) * (W + 80);
      const py = 1120 + i * 26 + Math.sin((x / 60) * Math.PI * 3 + i * 0.7) * (30 + i * 8);
      pts.push(`${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    out += `<path d="M ${pts.join(" L ")}" fill="none" stroke="${c}" stroke-width="1.8" opacity="${i === 0 ? 0.55 : 0.4}"/>`;
  });
  return out;
}

// ── slides ───────────────────────────────────────────────────────────────────

/** Which diagram a slide gets. Template first; index rotation for the rest. */
const BY_TEMPLATE: Record<string, string> = {
  quote: "pins",
  bigStat: "scatter",
  timeline: "timeline",
  worksheet: "worksheet",
  numbered: "worksheet",
  twoColumn: "waves",
  cardGrid: "branches",
  iconGrid: "branches",
  divider: "statement",
};
const ROTATION = ["scatter", "branches", "pins", "timeline", "waves", "worksheet", "statement"];

function coverSvg(s: KoyopoSlide, author?: string): string {
  const t = fit(s.title ?? "", 800, 96, 54, 4, GW.serif);
  const top = 430 - ((t.lines.length - 1) * t.size * 1.06) / 2;
  let out = `<rect width="${W}" height="${H}" fill="${C.paper}"/>${coverWave()}`;
  t.lines.forEach((line, i) =>
    out += `<text x="96" y="${top + i * t.size * 1.06}" font-family="${SERIF}" font-size="${t.size}" fill="${C.ink}">${esc(line)}</text>`);
  if (s.subtitle) {
    const st = fit(s.subtitle, 700, 27, 20, 2, GW.sans);
    st.lines.forEach((line, i) =>
      out += `<text x="96" y="${top + t.lines.length * t.size * 1.06 + 44 + i * (st.size + 8)}" font-family="${SANS}" font-size="${st.size}" fill="${C.muted}">${esc(line)}</text>`);
  }
  if (author)
    out += `<text x="96" y="${H - 74}" font-family="${SANS}" font-size="21" fill="${C.muted}">${esc(author)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${out}</svg>`;
}

function slideSvg(s: KoyopoSlide, n: number, total: number, kind: string, seed: string): string {
  let out = `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;

  // Copy sits at the top and stays short — two or three lines. The reference
  // decks never fill the page with text; the drawing carries the slide.
  let y = 150;
  if (s.title) {
    const t = fit(s.title, 830, 36, 26, 3, GW.sansBold);
    t.lines.forEach((line, i) =>
      out += `<text x="96" y="${y + i * (t.size + 12)}" font-family="${SANS}" font-size="${t.size}" font-weight="600" fill="${C.ink}">${esc(line)}</text>`);
    y += t.lines.length * (t.size + 12) + 10;
  }
  if (s.body) {
    const b = fit(s.body, 820, 27, 20, 3, GW.sans);
    b.lines.forEach((line, i) =>
      out += `<text x="96" y="${y + i * (b.size + 10)}" font-family="${SANS}" font-size="${b.size}" fill="${C.body}">${esc(line)}</text>`);
  }

  const items = s.items ?? [];
  const cols = s.columns?.flatMap((c) => [c.heading, ...c.items]) ?? [];
  const pool = items.length ? items : cols.length ? cols : [s.subtitle, s.statLabel].filter(Boolean) as string[];

  switch (kind) {
    case "scatter": out += dScatter(seed + n); break;
    case "branches": out += dBranches(pool); break;
    case "pins": out += dPins(pool, s.subtitle); break;
    case "timeline": out += dTimeline(pool); break;
    case "worksheet": out += dWorksheet(pool); break;
    case "waves": out += dWaves(pool); break;
    default: out += dStatement(pool, s.subtitle); break;
  }

  out += `<text x="${W / 2}" y="${H - 62}" text-anchor="middle" font-family="${SERIF}" font-size="22" fill="${C.muted}">${n}</text>`;
  void total;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${out}</svg>`;
}

export interface PaperOptions {
  seed?: string;
  author?: string;
}

export async function renderPaperDeck(slides: KoyopoSlide[], opts: PaperOptions = {}): Promise<Buffer[]> {
  const seed = opts.seed ?? "paper";
  const out: Buffer[] = [];
  let page = 0;
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const isCover = i === 0 || s.template === "title";
    if (isCover) {
      out.push(await sharp(Buffer.from(coverSvg(s, opts.author))).png().toBuffer());
      continue;
    }
    page += 1;
    // Template wins where it maps to a shape; otherwise rotate, so a deck of
    // eight generic slides still gets eight different drawings.
    const kind = BY_TEMPLATE[s.template] ?? ROTATION[page % ROTATION.length];
    out.push(await sharp(Buffer.from(slideSvg(s, page, slides.length, kind, seed))).png().toBuffer());
  }
  return out;
}
