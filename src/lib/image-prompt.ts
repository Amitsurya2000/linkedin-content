/**
 * Premium LinkedIn image-prompt engine.
 *
 * Strategy for ZERO text mistakes + a clean, low-text editorial look (matching
 * the reference graphics): the AI generates a TEXT-FREE premium background in a
 * distinct professional aesthetic, and we overlay the short headline ourselves
 * with a real font (see compose.ts). Palettes are deliberately DIVERSE and
 * sophisticated (beige+mauve, navy, charcoal, ivory, marble, emerald,
 * platinum…), not locked to the app's red UI brand.
 */

import type { OverlayTheme } from "@/lib/compose";

export interface PostImageInput {
  hook: string;
  hookCategory?: string;
  topic?: string;
  industry?: string;
  cta?: string; // post's call-to-action (shortened into a pill)
  author?: string; // client's name, for the italic sign-off on quote cards
}

const MARK_STOP = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","is","are","was","were","be","you","your","i","we","it","that","this","if","as","at","by","not","from","into","than","then","so","my","our","they","them","he","she","his","her","who","what","how","why","when","will","can","just","only","more","most","every","all"]);

/**
 * Wrap the 1–2 strongest words of a line in **markers** so the compositor
 * paints them gold — matching the reference "keyword highlight" look. Picks the
 * longest non-stop words (varies naturally per hook). Respects existing marks.
 */
export function markKeywords(text: string): string {
  if (text.includes("**")) return text;
  const words = text.split(/\s+/);
  const scored = words
    .map((w, i) => ({ i, clean: w.replace(/[^A-Za-z0-9']/g, "").toLowerCase(), raw: w }))
    .filter((x) => x.clean.length >= 4 && !MARK_STOP.has(x.clean));
  scored.sort((a, b) => b.clean.length - a.clean.length);
  const pick = new Set(scored.slice(0, Math.min(2, scored.length)).map((x) => x.i));
  return words.map((w, i) => (pick.has(i) ? `**${w}**` : w)).join(" ");
}

/** A short eyebrow badge derived from the hook category (2 words max). */
function badgeFrom(hookCategory?: string): string {
  const c = (hookCategory || "").replace(/^the\s+/i, "").replace(/hook/i, "").trim();
  if (!c) return "Insight";
  return c.split(/\s+/).slice(0, 2).join(" ");
}

/** A short, punchy CTA pill (2-4 words). Falls back to a strong default. */
function ctaShort(cta?: string): string {
  let t = (cta || "").replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");
  // Prefer a crisp imperative; if the model gave a long question, use a default.
  const words = t.split(" ");
  if (!t || words.length > 4) {
    return "Follow for more";
  }
  return t;
}

// Softened toward AUTHENTIC + minimal (removed the "8k / ultra-premium / award-
// winning" triggers that make images read as slick AI stock).
const QUALITY =
  "refined editorial minimalism, understated and authentic, soft natural lighting, elegant restraint, tasteful negative space, timeless and human, subtle organic texture, not glossy, not artificial";

// A stronger, film-photography feel for the "Authentic" styles.
const AUTH_QUALITY =
  "shot on 35mm film, Kodak Portra 400, natural film grain, soft natural window light, candid and quiet, muted desaturated tones, editorial minimalism, lots of calm negative space, real authentic photograph, imperfect and human, NOT CGI, not a 3D render, not a glossy stock photo, no HDR";

// The AI must NOT render any text — we overlay it ourselves for perfect spelling.
const NO_TEXT =
  "ABSOLUTELY NO text, no words, no letters, no numbers, no typography, no captions, no watermark, no logos anywhere in the image";

// ── Text helpers ─────────────────────────────────────────────────────────────

/** Reduce a hook to a SHORT, punchy, clean line — fewer words = cleaner design. */
export function cardText(hook: string, maxWords = 8, maxChars = 54): string {
  let t = (hook || "").replace(/\s+/g, " ").trim();
  t = t.split(/(?<=[.!?])\s/)[0] || t;
  if (t.length > maxChars + 8) {
    const clause = t.split(/[,—–:;]/)[0].trim();
    if (clause.length >= 12) t = clause;
  }
  // Keep apostrophes (we render text ourselves, so "don't" is fine); drop only
  // double-quotes / backticks and normalise curly apostrophes to straight.
  t = t.replace(/[“”"«»`]/g, "").replace(/[‘’]/g, "'").replace(/[—–]/g, "-").replace(/\.\.\.$/, "").trim();
  const words = t.split(" ");
  if (words.length > maxWords) t = words.slice(0, maxWords).join(" ");
  if (t.length > maxChars) t = t.slice(0, maxChars - 1).trim();
  // Never end a trimmed line on a dangling article/preposition ("...was the").
  const STOP = new Set(["the", "a", "an", "was", "is", "to", "of", "and", "that", "my", "i", "in", "on", "for", "with", "but", "or", "it", "as", "at", "by", "this", "your", "you", "are", "were", "our", "we", "so", "if", "no", "not", "than", "then", "into", "from"]);
  let ws = t.split(" ");
  while (ws.length > 3 && STOP.has(ws[ws.length - 1].toLowerCase())) ws.pop();
  t = ws.join(" ");
  return t.replace(/\.$/, "");
}

function topicPhrase(input: PostImageInput): string {
  return (input.topic || input.industry || "professional success and growth").replace(/\s+/g, " ").trim().slice(0, 120);
}

// ── Style definitions ────────────────────────────────────────────────────────

export interface StyleDef {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  /** Text-free background prompt for the image model. */
  build: (input: PostImageInput) => string;
  /** Overlay config; return null for a purely visual (no-text) style. */
  overlay: (input: PostImageInput) => { text: string; theme: OverlayTheme } | null;
}

const P = (width: number, height: number) => ({ width, height });
const compose = (...parts: string[]) => parts.filter(Boolean).join(" ");

// Authentic photo + masterclass craft: a small gold eyebrow badge (top), a hero
// hook with one accent word (bottom), and a clean CTA pill — attention-grabbing
// and professional, while the film photograph keeps it human. (badge/cta left
// undefined so buildStyledPrompt injects them from the post.)
function authOverlay(hook: string): { text: string; theme: OverlayTheme } {
  return {
    text: cardText(hook, 8, 52),
    theme: {
      fg: "#FFFFFF", accent: "#E8C88A", font: "serif", align: "left",
      scrim: "gradient-bottom", position: "bottom", accentWords: 1,
      letterSpacing: 0, maxLines: 3,
    },
  };
}

// ── Editorial system: clean charcoal canvas + app-drawn graphic accents ──────
const GOLD = "#D9AD45"; // muted editorial gold

// Clean charcoal backgrounds via SHORT, POSITIVE-only prompts (image models ignore
// "NO/AVOID" lists and adds the clutter you banned — so we never list avoids).
const EDIT_BG: Record<string, string> = {
  vignette: `A minimalist editorial background, 1:1 square: a matte near-black charcoal surface (#0A0A0A) with extremely subtle tonal variation, a soft gentle vignette, fine paper-like film grain and quiet dimensional depth. Understated premium business-magazine aesthetic, calm and high-authority, vast empty negative space. No text.`,
  lightshaft: `A minimalist editorial background, 1:1 square: deep charcoal (#0B0B0B) with one soft faint diagonal shaft of warm neutral light entering from the top-left corner, subtle film grain and a tactile paper feel, mostly empty and calm. Premium founder-publication look. No text.`,
  paper: `A minimalist editorial background, 1:1 square: near-black charcoal with a faint tactile paper texture, even quiet tone, a whisper of warm light on one edge for depth, generous empty space. Refined and premium. No text.`,
  flat: `A minimalist editorial background, 1:1 square: an almost-flat deep near-black charcoal (#080808) with only the faintest tonal gradient and fine micro film grain, extremely minimal and tactile, enormous empty space. No text.`,
};

/** Pick a professional conceptual line-icon from the hook / topic. */
function pickIcon(input: PostImageInput): string {
  const t = `${input.hook || ""} ${input.topic || ""} ${input.industry || ""}`.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  if (has("brand", "position", "stand out", "authority", "attention", "visib", "ignore")) return "target";
  if (has("grow", "scale", "revenue", "10x", "increase", "profit", "sales", "result", "compound")) return "growth";
  if (has("risk", "bold", "fear", "regret", "comfort", "leap", "brave")) return "mountain";
  if (has("free", "escape", "trapp", "stuck", "chain", "break", "control", "delegate")) return "chain";
  if (has("idea", "creativ", "insight", "think", "learn", "content", "story")) return "bulb";
  if (has("decision", "choose", "direction", "path", "strateg", "clarity", "focus")) return "compass";
  if (has("trust", "protect", "secur", "safe", "reliab")) return "shield";
  if (has("data", "metric", "chart", "measur", "analytic", "number", "kpi")) return "chart";
  if (has("time", "deadline", "fast", "speed", "hour", "90 day", "first 90")) return "clock";
  if (has("key", "secret", "unlock", "access", "hidden")) return "key";
  return "spark";
}

interface EditOpts {
  font?: "serif" | "sans";
  align?: "center" | "left";
  underline?: boolean;
  graphic?: "none" | "frame" | "watermark" | "icon" | "divider";
  eyebrow?: boolean;
  author?: boolean; // default true
  watermark?: string;
}

function editorialOverlay(input: PostImageInput, opts: EditOpts = {}): { text: string; theme: OverlayTheme } {
  const align = opts.align || (opts.graphic === "watermark" ? "left" : "center");
  const theme: OverlayTheme = {
    fg: "#FFFFFF", accent: GOLD, font: opts.font || "serif", align,
    scrim: "none", position: "center", maxLines: 5,
    author: opts.author === false ? undefined : input.author || undefined,
    underline: opts.underline || false, badge: "", cta: "",
    graphic: opts.graphic || "none",
    graphicIcon: opts.graphic === "icon" ? pickIcon(input) : undefined,
    watermark: opts.graphic === "watermark" ? opts.watermark || "01" : undefined,
    eyebrow: opts.eyebrow ? badgeFrom(input.hookCategory) : undefined,
  };
  return { text: markKeywords(cardText(input.hook, align === "left" ? 15 : 18, align === "left" ? 110 : 132)), theme };
}

export const STYLES: StyleDef[] = [
  // ─────────── EDITORIAL · CHARCOAL + GOLD (clean, app-drawn accents, varied) ───────────
  {
    id: "authority-quote",
    name: "Editorial · Framed",
    category: "Authority",
    ...P(1024, 1024),
    build: () => compose(EDIT_BG.vignette, NO_TEXT + "."),
    overlay: (i) => editorialOverlay(i, { font: "serif", graphic: "frame", eyebrow: true, underline: true }),
  },
  {
    id: "authority-glow",
    name: "Editorial · Icon",
    category: "Authority",
    ...P(1024, 1024),
    build: () => compose(EDIT_BG.vignette, NO_TEXT + "."),
    overlay: (i) => editorialOverlay(i, { font: "serif", graphic: "icon" }),
  },
  {
    id: "authority-smoke",
    name: "Editorial · Divider",
    category: "Authority",
    ...P(1024, 1024),
    build: () => compose(EDIT_BG.paper, NO_TEXT + "."),
    overlay: (i) => editorialOverlay(i, { font: "sans", graphic: "divider", eyebrow: true }),
  },
  {
    id: "authority-lineart",
    name: "Editorial · Index",
    category: "Authority",
    ...P(1024, 1024),
    build: () => compose(EDIT_BG.flat, NO_TEXT + "."),
    overlay: (i) => editorialOverlay(i, { font: "sans", align: "left", graphic: "watermark", author: false }),
  },
  {
    id: "authority-silhouette",
    name: "Editorial · Light Shaft",
    category: "Authority",
    ...P(1024, 1024),
    build: () => compose(EDIT_BG.lightshaft, NO_TEXT + "."),
    overlay: (i) => editorialOverlay(i, { font: "serif" }),
  },
  {
    id: "authority-spotlight",
    name: "Editorial · Minimal",
    category: "Authority",
    ...P(1024, 1024),
    build: () => compose(EDIT_BG.flat, NO_TEXT + "."),
    overlay: (i) => editorialOverlay(i, { font: "serif", underline: true }),
  },

  // ─────────── AUTHENTIC / FILM (minimal, human, real photography) ───────────
  {
    id: "auth-window-light",
    name: "Authentic · Window Light",
    category: "Authentic",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A quiet, minimal interior photograph, 4:5: soft morning sunlight falling across a plain wall through a window, a sheer curtain, gentle shadows, vast calm empty space.`,
        AUTH_QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => authOverlay(i.hook),
  },
  {
    id: "auth-desk",
    name: "Authentic · Desk Corner",
    category: "Authentic",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A minimal, candid photograph, 4:5: a corner of a wooden desk near a window — an open notebook, a pen and a cup of coffee, soft natural light and long quiet shadows, plenty of empty space above.`,
        AUTH_QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => authOverlay(i.hook),
  },
  {
    id: "auth-portrait",
    name: "Authentic · Candid Portrait",
    category: "Authentic",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A candid, authentic film portrait, 4:5: a person by a window looking away in thought, softly out of focus, warm natural light, muted tones, large calm negative space beside them.`,
        AUTH_QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => authOverlay(i.hook),
  },
  {
    id: "auth-still-life",
    name: "Authentic · Still Life",
    category: "Authentic",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A minimal, quiet still-life photograph, 4:5: a single ceramic cup and a folded linen on a plain textured surface, soft daylight, muted earthy tones, generous empty space.`,
        AUTH_QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => authOverlay(i.hook),
  },
  {
    id: "auth-nature",
    name: "Authentic · Quiet Nature",
    category: "Authentic",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A serene, minimal photograph, 4:5: soft light through a single plant or branch against a plain muted wall, gentle shadows, calm and understated, lots of negative space.`,
        AUTH_QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => authOverlay(i.hook),
  },
  {
    id: "auth-paper",
    name: "Authentic · Paper & Light",
    category: "Authentic",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A minimal photograph, 4:5: a sheet of textured off-white paper on a plain surface catching soft raking daylight, delicate shadow, warm neutral tones, quiet and tactile, lots of empty space.`,
        AUTH_QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => authOverlay(i.hook),
  },

  // ── Reference 1: muted editorial Venn ──
  {
    id: "muted-editorial",
    name: "Muted Editorial",
    category: "Editorial",
    ...P(1024, 1280),
    build: (i) =>
      compose(
        `A refined, minimalist editorial background, 4:5, warm ivory / soft beige (#EDE6DD) paper.`,
        `Three large softly-overlapping translucent circles in muted dusty mauve, taupe and greige, gentle blend where they overlap, a lot of calm empty space at top and bottom for a title, subtle paper grain.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 52),
      theme: { fg: "#3A2E2A", accent: "#9C6B70", font: "serif", align: "center", scrim: "none", letterSpacing: 3, accentWords: 0, position: "top" },
    }),
  },
  // ── Reference 2: concentric zones ──
  {
    id: "concentric-zones",
    name: "Concentric Zones",
    category: "Framework",
    ...P(1024, 1280),
    build: (i) =>
      compose(
        `A clean concentric-circles graphic, 4:5, on soft off-white.`,
        `Nested rings forming a smooth bullseye gradient from deep navy (outer) through blues to warm amber and orange (center), subtle soft shadows between rings, positioned in the LOWER two-thirds of the frame, leaving the entire TOP THIRD clean empty off-white space for a title, modern premium infographic.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 6, 38),
      theme: { fg: "#0B2A4A", accent: "#E08A2C", font: "sans", align: "center", scrim: "none", letterSpacing: 1, accentWords: 0, uppercase: true, position: "top", maxLines: 2 },
    }),
  },
  // ── Executive / typography ──
  {
    id: "executive-navy",
    name: "Executive Navy",
    category: "Editorial",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A deep executive navy (#0B1F3A) background, 4:5, with a subtle darker vignette, faint diagonal light and a few fine drifting gold particles, elegant and calm, empty center for a title.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#FFFFFF", accent: "#C9A227", font: "serif", align: "center", scrim: "none", accentWords: 2 },
    }),
  },
  {
    id: "charcoal-gold",
    name: "Charcoal & Gold",
    category: "Typography",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A matte near-black charcoal (#111214) background, 4:5, with a subtle single soft gold light streak and faint grain, minimal and premium, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#FFFFFF", accent: "#D4AF37", font: "sans", align: "center", scrim: "none", accentWords: 1 },
    }),
  },
  {
    id: "ivory-minimal",
    name: "Ivory Minimal",
    category: "Typography",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A clean warm ivory / cream (#F5F1E8) background, 4:5, very minimal, subtle soft paper texture, one faint thin gold hairline accent, huge negative space.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#20242B", accent: "#B08A2E", font: "serif", align: "left", scrim: "none", accentWords: 0 },
    }),
  },
  {
    id: "swiss-minimal",
    name: "Swiss Minimalist",
    category: "Typography",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A crisp Swiss-style off-white background, 4:5, with one bold thin red rule crossing the composition and vast empty space, ultra-minimal design.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#111111", accent: "#D0342C", font: "sans", align: "left", scrim: "none", accentWords: 0 },
    }),
  },
  {
    id: "bold-mono",
    name: "Bold Monochrome",
    category: "Typography",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A stark pure-black background, 4:5, with a subtle soft top-down spotlight and gentle film grain, high-contrast minimal, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 7, 44),
      theme: { fg: "#FFFFFF", accent: "#FFFFFF", font: "sans", align: "center", scrim: "none", accentWords: 0, uppercase: true, letterSpacing: 1 },
    }),
  },
  // ── Editorial ──
  {
    id: "magazine-cover",
    name: "Luxury Magazine Cover",
    category: "Editorial",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A luxury business-magazine cover background, 4:5, deep navy with a subtle gold kicker bar near the top and thin column rules, sophisticated editorial layout, empty space for a cover line.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 9, 56),
      theme: { fg: "#FFFFFF", accent: "#C9A227", font: "serif", align: "left", scrim: "none", accentWords: 0 },
    }),
  },
  {
    id: "newspaper-column",
    name: "Editorial Column",
    category: "Editorial",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A sophisticated editorial feature background, 4:5, off-white newsprint paper with a faint texture and one thin gold horizontal rule in the upper third, refined and calm.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 9, 56),
      theme: { fg: "#1A1A1A", accent: "#9C6B2F", font: "serif", align: "left", scrim: "none", accentWords: 0 },
    }),
  },
  {
    id: "midnight-cinematic",
    name: "Cinematic Spotlight",
    category: "Editorial",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A cinematic dark poster background, 4:5, midnight blue-black with a soft dramatic central spotlight, volumetric haze and moody chiaroscuro lighting, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#F5F5F5", accent: "#8FB3D9", font: "serif", align: "center", scrim: "none", accentWords: 0 },
    }),
  },
  // ── Luxury ──
  {
    id: "marble-luxury",
    name: "Marble & Gold",
    category: "Luxury",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A luxurious polished white Carrara marble background, 4:5, soft grey veining with delicate real gold-leaf inlay accents, soft studio reflections, opulent and clean, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#23262B", accent: "#B08A2E", font: "serif", align: "center", scrim: "none", accentWords: 1 },
    }),
  },
  {
    id: "gold-particle",
    name: "Gold Particle Dark",
    category: "Luxury",
    ...P(1024, 1280),
    build: () =>
      compose(
        `An elegant dark background, 4:5, deep espresso-black with a cloud of fine golden bokeh particles and soft light drifting from one side, luxurious and refined, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#FFFFFF", accent: "#E4C463", font: "serif", align: "center", scrim: "dark", accentWords: 1 },
    }),
  },
  {
    id: "silk-abstract",
    name: "Luxury Silk (no text)",
    category: "Luxury",
    ...P(1024, 1280),
    build: (i) =>
      compose(
        `An abstract luxury visual, 4:5: flowing deep-navy and charcoal silk with drifting gold particles and soft light streaks, a premium metaphor for "${topicPhrase(i)}", elegant curves, calm negative space.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: () => null,
  },
  // ── Modern ──
  {
    id: "platinum-minimal",
    name: "Platinum Minimal",
    category: "Modern",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A soft platinum-grey gradient background, 4:5, from light silver to cool grey with brushed-metal sheen and a subtle thin silver rule, ultra-minimal Apple-keynote aesthetic, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#1C1F24", accent: "#6B7280", font: "sans", align: "center", scrim: "none", accentWords: 0 },
    }),
  },
  {
    id: "gradient-mesh",
    name: "Gradient Mesh",
    category: "Modern",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A modern SaaS-grade gradient-mesh background, 4:5: smooth indigo, violet and deep-blue mesh gradient with soft grain and gentle glow, contemporary premium tech aesthetic, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#FFFFFF", accent: "#C7B8FF", font: "sans", align: "center", scrim: "none", accentWords: 0 },
    }),
  },
  {
    id: "blueprint",
    name: "Blueprint Schematic",
    category: "Modern",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A refined blueprint background, 4:5, deep blueprint-blue with fine faint white grid lines and subtle technical tick-marks, architect-grade, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 7, 44),
      theme: { fg: "#FFFFFF", accent: "#9FC2E8", font: "mono", align: "left", scrim: "none", accentWords: 0, uppercase: true, letterSpacing: 1 },
    }),
  },
  {
    id: "warm-sand",
    name: "Warm Sand",
    category: "Editorial",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A refined warm sand / taupe (#E7DFD3) background, 4:5, with soft organic shapes in bronze and clay tones drifting at the edges, calm and sophisticated, empty center.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook),
      theme: { fg: "#3A2A1E", accent: "#A9702F", font: "serif", align: "center", scrim: "none", letterSpacing: 2, accentWords: 0 },
    }),
  },
  {
    id: "isometric-concept",
    name: "Isometric Concept (no text)",
    category: "Modern",
    ...P(1024, 1024),
    build: (i) =>
      compose(
        `A clean 3D isometric concept illustration, 1:1, on a soft neutral studio background, a minimal metaphor for "${topicPhrase(i)}" (e.g. steps rising to a goal, a growth chart, a chess piece), rendered in tasteful matte navy, warm grey and gold materials, soft studio light, premium C4D style, minimal.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: () => null,
  },

  // ─────────── DOCUMENTARY / CINEMATIC (the background IS the concept) ───────────
  {
    id: "doc-desk-night",
    name: "Documentary · Late Night",
    category: "Documentary",
    ...P(1024, 1280),
    build: (i) =>
      compose(
        `A cinematic documentary photograph, 4:5: a lone professional silhouetted at a laptop in a dark modern office late at night, warm desk lamp glow, blurred city lights through a window behind, a visual story of dedication and "${topicPhrase(i)}".`,
        `Shallow depth of field, film grain, moody teal-and-amber cinematic color grade, editorial, the LOWER third darker and calm for a caption.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 50),
      theme: { fg: "#FFFFFF", accent: "#F0B429", font: "sans", align: "left", scrim: "gradient-bottom", position: "bottom", accentWords: 1 },
    }),
  },
  {
    id: "doc-summit",
    name: "Documentary · The Summit",
    category: "Documentary",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A cinematic documentary photograph, 4:5: a single figure standing on a mountain summit at golden-hour, vast landscape below, dramatic clouds, a story of ambition and arrival.`,
        `Epic wide shot, film grain, warm golden cinematic grade, the LOWER third darker for a caption.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 50),
      theme: { fg: "#FFFFFF", accent: "#F5D06B", font: "serif", align: "left", scrim: "gradient-bottom", position: "bottom", accentWords: 1 },
    }),
  },
  {
    id: "doc-skyline",
    name: "Documentary · City Scale",
    category: "Documentary",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A cinematic documentary photograph, 4:5: a sweeping business-district skyline at blue-hour dusk, glowing office towers, a sense of scale and momentum.`,
        `Aerial wide shot, subtle film grain, deep blue cinematic grade with warm window lights, the LOWER third darker for a caption.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 50),
      theme: { fg: "#FFFFFF", accent: "#7FC8F0", font: "sans", align: "left", scrim: "gradient-bottom", position: "bottom", accentWords: 1 },
    }),
  },
  {
    id: "doc-road",
    name: "Documentary · The Road",
    category: "Documentary",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A cinematic documentary photograph, 4:5: a long open road stretching toward a distant horizon at sunrise, soft mist, a metaphor for the journey and the decision ahead.`,
        `Centered vanishing point, film grain, warm hopeful cinematic grade, the LOWER third darker for a caption.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 50),
      theme: { fg: "#FFFFFF", accent: "#F0B429", font: "serif", align: "left", scrim: "gradient-bottom", position: "bottom", accentWords: 1 },
    }),
  },
  {
    id: "doc-hands",
    name: "Documentary · The Craft",
    category: "Documentary",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A cinematic documentary close-up photograph, 4:5: hands working intently — writing in a notebook or on a keyboard — warm side light, rich shallow focus, a story of craft and focus.`,
        `Macro detail, film grain, warm editorial cinematic grade, the LOWER third darker for a caption.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 50),
      theme: { fg: "#FFFFFF", accent: "#F0C05A", font: "sans", align: "left", scrim: "gradient-bottom", position: "bottom", accentWords: 1 },
    }),
  },
  {
    id: "doc-boardroom",
    name: "Documentary · The Room",
    category: "Documentary",
    ...P(1024, 1280),
    build: () =>
      compose(
        `A cinematic documentary photograph, 4:5: a grand empty modern boardroom with a long table, dramatic window light and long shadows, a quiet story of leadership and decisions.`,
        `Architectural wide shot, film grain, cool cinematic grade with a warm light source, the LOWER third darker for a caption.`,
        QUALITY + ".", NO_TEXT + "."
      ),
    overlay: (i) => ({
      text: cardText(i.hook, 8, 50),
      theme: { fg: "#FFFFFF", accent: "#C9A227", font: "serif", align: "left", scrim: "gradient-bottom", position: "bottom", accentWords: 1 },
    }),
  },
];

// Convenience lookups
export const STYLE_IDS = STYLES.map((s) => s.id);
// Curated pool for "auto": the approved Black+Gold authority template (varied)
// plus a few authentic film styles — so it stays on-brand yet never repeats.
export const DEFAULT_STYLE_IDS = STYLES.filter(
  (s) => s.category === "Authority" || ["auth-desk", "auth-portrait", "auth-window-light"].includes(s.id)
).map((s) => s.id);
/**
 * The 29 design movements, as a data table.
 *
 * These are AESTHETICS, not layouts — Brutalism and Wabi Sabi describe how a
 * picture should feel, not where the text sits. So each one supplies only the
 * scene fragment and inherits the same quality and no-text rules every other
 * style obeys, rather than repeating a hand-written prompt 29 times.
 *
 * Each fragment names materials, colour and light, because that is what an image
 * model can actually act on. "Y2K aesthetic" alone produces a stock collage;
 * "translucent blue plastic, chrome bubbles, lens flare on white" produces Y2K.
 *
 * Every fragment also avoids subjects that are made of text or numbers — screens
 * of code, dashboards, signage — for the reason recorded elsewhere in this file:
 * an image model renders their content as garbled lettering however firmly the
 * prompt forbids it.
 */
export const AESTHETICS: { id: string; name: string; scene: string }[] = [
  { id: "aes-minimalism", name: "Minimalism", scene: "vast empty off-white space with a single small object placed off-centre, one soft shadow, restrained neutral palette" },
  { id: "aes-maximalism", name: "Maximalism", scene: "densely layered pattern on pattern, saturated jewel tones, ornate repeating motifs filling every inch, rich and deliberately excessive" },
  { id: "aes-swiss", name: "Swiss Design", scene: "strict grid, enormous negative space, one red rule crossing a white field, precise geometric alignment, objective and cool" },
  { id: "aes-brutalism", name: "Brutalism", scene: "raw board-marked concrete, heavy monolithic forms, hard directional daylight, stark unpolished surfaces" },
  { id: "aes-surrealism", name: "Surrealism", scene: "impossible scale and floating objects in a calm dreamlike landscape, long shadows, soft unreal light" },
  { id: "aes-neo-brutalism", name: "Neo-Brutalism", scene: "flat blocks of clashing saturated colour, thick black outlines, hard offset shadows, deliberately crude geometry" },
  { id: "aes-neoclassical", name: "Neo-classical", scene: "white marble columns and carved drapery, symmetrical composition, cool museum light, restrained classical ornament" },
  { id: "aes-neumorphism", name: "Neumorphism", scene: "soft extruded shapes in a single pale grey, gentle inner and outer shadows, tactile pillowy surfaces, almost no contrast" },
  { id: "aes-scrapbook", name: "Scrapbook", scene: "torn paper layers, masking tape, thread and pressed flowers on kraft card, handmade collage with visible edges" },
  { id: "aes-glassmorphism", name: "Glassmorphism", scene: "frosted translucent glass panels floating over a soft colour gradient, blurred depth, thin bright edges, luminous" },
  { id: "aes-claymorphism", name: "Claymorphism", scene: "rounded matte clay forms in soft pastel, chunky friendly volumes, gentle studio light, 3D and toy-like" },
  { id: "aes-bento", name: "Bento Grid", scene: "a grid of rounded rectangular compartments of varying size, each holding one simple object, clean and orderly, soft even light" },
  { id: "aes-pixel", name: "Pixel Art", scene: "chunky visible pixels, limited 16-colour palette, crisp dithering, retro game rendering with hard square edges" },
  { id: "aes-sketch", name: "Conceptual Sketch", scene: "loose graphite lines on textured paper, visible construction marks and smudges, unfinished hand-drawn study" },
  { id: "aes-luxury-type", name: "Luxury Typography", scene: "deep black ground with fine gold foil linework, generous margins, subtle emboss and grain, restrained and expensive" },
  { id: "aes-editorial", name: "Editorial Design", scene: "magazine spread photography, strong single subject, wide margins, muted print-like colour and paper grain" },
  { id: "aes-y2k", name: "Y2K Aesthetic", scene: "translucent blue plastic, chrome bubbles and metallic gradients, lens flare on glossy white, late-nineties optimism" },
  { id: "aes-ethereal", name: "Ethereal", scene: "pale mist and diffused backlight, weightless floating fabric, near-white palette with the faintest blush, dreamlike and soft" },
  { id: "aes-bohemian", name: "Bohemian", scene: "warm terracotta and ochre textiles, woven rattan and dried grasses, low golden afternoon light, layered and lived-in" },
  { id: "aes-dark-ui", name: "Dark Mode UI", scene: "near-black surface with one cold accent glow, subtle depth and soft rim light on simple geometric forms, quiet and precise" },
  { id: "aes-cyberpunk", name: "Cyberpunk", scene: "rain-slick street at night, magenta and cyan neon reflections, dense atmosphere and haze, high contrast" },
  { id: "aes-anthropomorphic", name: "Anthropomorphic", scene: "everyday objects given faces and posture, warm character lighting, playful expressive forms, charming and slightly absurd" },
  { id: "aes-victorian", name: "Victorian", scene: "engraved botanical ornament, oxblood and forest green, aged paper and gilt edging, dense decorative framing" },
  { id: "aes-cybercore", name: "Cybercore", scene: "exposed circuitry and ribbon cable, brushed aluminium and acid green, cold technical light, machine-like detail" },
  { id: "aes-synthwave", name: "Synthwave", scene: "purple to orange gradient sunset, a glowing horizon grid receding to a vanishing point, chrome highlights, retro-futurist" },
  { id: "aes-graffiti", name: "Graffiti", scene: "spray paint on weathered concrete, overlapping tags and drips, bold colour over grit, urban and energetic" },
  { id: "aes-gothic", name: "Gothic", scene: "pointed arches and deep shadow, cold stone and stained-glass colour cast, dramatic vertical light, sombre" },
  { id: "aes-mixed-media", name: "Mixed Media", scene: "photography torn and layered with painted brushwork, ink and cut paper, visible seams between materials, textural" },
  { id: "aes-wabi-sabi", name: "Wabi Sabi", scene: "a single imperfect ceramic vessel, visible repair and asymmetry, raw linen and unglazed clay, soft north light, quiet and worn" },
];

/**
 * Turn an aesthetic into a full StyleDef.
 *
 * The overlay is deliberately the same restrained editorial treatment for all
 * of them: the movement should show in the IMAGE, not in a different text
 * layout per style. 1024x1280 is 4:5, the feed-native ratio.
 */
const AESTHETIC_STYLES: StyleDef[] = AESTHETICS.map(({ id, name, scene }) => ({
  id,
  name,
  category: "Aesthetic",
  ...P(1024, 1280),
  build: () => compose(`${scene}, 4:5 composition.`, QUALITY + ".", NO_TEXT + "."),
  overlay: (i: PostImageInput) => editorialOverlay(i, { font: "sans", graphic: "none", eyebrow: true }),
}));

// Appended rather than spliced in, so every existing style keeps its index —
// styleForIndex() rotates by position, and inserting above would silently
// change which style an existing post maps to.
STYLES.push(...AESTHETIC_STYLES);

export const STYLE_BY_ID: Record<string, StyleDef> = Object.fromEntries(STYLES.map((s) => [s.id, s]));

export interface StyleMeta {
  id: string;
  name: string;
  category: string;
}
export const STYLE_META: StyleMeta[] = STYLES.map(({ id, name, category }) => ({ id, name, category }));

export function styleForIndex(index: number): StyleDef {
  return STYLES[index % STYLES.length];
}

/**
 * Build the text-free background prompt + overlay config for a style id
 * (falls back to muted-editorial).
 */
export function buildStyledPrompt(
  input: PostImageInput,
  styleId?: string
): {
  prompt: string;
  width: number;
  height: number;
  styleId: string;
  styleName: string;
  overlay: { text: string; theme: OverlayTheme } | null;
} {
  const style = (styleId && STYLE_BY_ID[styleId]) || STYLE_BY_ID["authority-quote"];
  const overlay = style.overlay(input);
  // Concept-first, low-text architecture: every text image also gets a small
  // eyebrow badge + a CTA pill (unless the style already set them). Pure-visual
  // styles (overlay === null) stay text-free.
  if (overlay) {
    if (overlay.theme.badge === undefined) overlay.theme.badge = badgeFrom(input.hookCategory);
    if (overlay.theme.cta === undefined) overlay.theme.cta = ctaShort(input.cta);
  }
  return {
    prompt: style.build(input),
    width: style.width,
    height: style.height,
    styleId: style.id,
    styleName: style.name,
    overlay,
  };
}
