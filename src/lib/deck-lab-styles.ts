/**
 * Deck style specs — pure data, no renderer.
 *
 * Split from deck-lab.ts because the create page needs the labels and blurbs to
 * draw the style buttons, and deck-lab.ts imports sharp. Importing the renderer
 * into a client component pulls a Node-only binary into the browser bundle and
 * the page 500s.
 */

const GLYPH_W = {
  sans: { regular: 0.545, bold: 0.575 },
  serif: { regular: 0.5, bold: 0.53 },
  mono: { regular: 0.6, bold: 0.6 },
} as const;

export type FaceKind = keyof typeof GLYPH_W;
export { GLYPH_W };

/** Installed families, with fallbacks so a missing face degrades rather than blanks. */
export const FACE: Record<FaceKind, string> = {
  sans: "Poppins, Segoe UI, Arial, sans-serif",
  serif: "Georgia, Times New Roman, serif",
  mono: "Consolas, Courier New, monospace",
};

export interface StyleSpec {
  label: string;
  /** One-line description, surfaced in the UI as the button's tooltip. */
  blurb: string;
  bg: string;
  /** Optional ground texture drawn behind everything. */
  texture?: "grid" | "dots" | "rules" | "none";
  textureColor?: string;
  ink: string;
  body: string;
  muted: string;
  accent: string;
  /** Body card fill. `null` means no card — copy sits directly on the ground. */
  card: string | null;
  /** Takeaway card fill. */
  card2: string | null;
  /** Full-bleed cover ground; falls back to `bg`. */
  deep?: string;
  onDeep?: string;
  headFace: FaceKind;
  bodyFace: FaceKind;
  headWeight: number;
  headUpper?: boolean;
  align: "left" | "center";
  /** How the slide number is drawn. */
  marker: "chip" | "square" | "rule" | "bracket" | "inline" | "none";
  /** Corner radius on cards. 0 gives hard corners. */
  radius: number;
  /** Hairline rule under the heading. */
  headRule?: boolean;
  /**
   * How this style carries a picture when one is supplied.
   *  "band"   — full-width image across the top, copy beneath (light grounds)
   *  "bottom" — copy on top, image below it. The walkthrough shape: you read the
   *             instruction, then see the screenshot that proves it.
   *  "bleed"  — image fills the slide under a scrim, copy on top (dark grounds)
   * Styles whose whole identity is the absence of imagery declare "none".
   */
  imageFit?: "band" | "bottom" | "bleed" | "none";
  /** Small site/handle mark, upper-left. */
  wordmark?: boolean;
  /** Sign the deck bottom-right in accent italic — the creator's hand. */
  signature?: boolean;
}

export const LAB_STYLES: Record<string, StyleSpec> = {
  /** Newspaper op-ed: serif, hairline rules, generous margins, no cards. */
  press: {
    label: "Press", blurb: "Newsprint editorial — serif, hairline rules, no cards",
    bg: "#F6F4EF", texture: "none",
    ink: "#14120F", body: "#3A342C", muted: "#8A8074", accent: "#8C2F1D",
    card: null, card2: "#EAE5DA", deep: "#14120F", onDeep: "#F6F4EF",
    headFace: "serif", bodyFace: "serif", headWeight: 700,
    align: "left", marker: "rule", radius: 0, headRule: true, imageFit: "band",
  },

  /** Terminal: dark ground, monospace, one signal colour. */
  terminal: {
    label: "Terminal", blurb: "Dark, monospace, one signal colour — engineering voice",
    bg: "#0C0F12", texture: "grid", textureColor: "rgba(120,200,160,0.07)",
    ink: "#E8EDEA", body: "#9FB0A8", muted: "#5D6B65", accent: "#4ADE80",
    card: "#12171B", card2: "#151D19", deep: "#080A0C", onDeep: "#E8EDEA",
    headFace: "mono", bodyFace: "mono", headWeight: 700,
    align: "left", marker: "bracket", radius: 6, imageFit: "bleed",
  },

  /** Squared paper with a marker highlight — study-notes feel. */
  notebook: {
    label: "Notebook", blurb: "Squared paper and marker — handwritten study notes",
    bg: "#FCFBF7", texture: "grid", textureColor: "rgba(90,120,170,0.13)",
    ink: "#1B2430", body: "#3E4A59", muted: "#8B96A3", accent: "#E8B004",
    card: "#FFFFFF", card2: "#FFF6D9", deep: "#1B2430", onDeep: "#FCFBF7",
    headFace: "sans", bodyFace: "sans", headWeight: 700,
    align: "left", marker: "square", radius: 10, imageFit: "band",
  },

  /** Consulting deck: white, navy, boxed, structured. */
  consulting: {
    label: "Consulting", blurb: "White and navy, boxed and structured — strategy-deck formality",
    bg: "#FFFFFF", texture: "none",
    ink: "#0A2540", body: "#3D5166", muted: "#8A9AAC", accent: "#0A66C2",
    card: "#F2F6FA", card2: "#E4EDF6", deep: "#0A2540", onDeep: "#FFFFFF",
    headFace: "sans", bodyFace: "sans", headWeight: 600,
    align: "left", marker: "square", radius: 4, headRule: true, imageFit: "band",
  },

  /** Swiss/International: huge type on a grid, red-black-white, centred. */
  swiss: {
    label: "Swiss", blurb: "Oversized type on a strict grid — red, black, white",
    bg: "#F2F2F2", texture: "rules", textureColor: "rgba(0,0,0,0.05)",
    ink: "#0B0B0B", body: "#3A3A3A", muted: "#8C8C8C", accent: "#E4032E",
    card: null, card2: "#E4032E", deep: "#0B0B0B", onDeep: "#F2F2F2",
    headFace: "sans", bodyFace: "sans", headWeight: 800, headUpper: true,
    align: "left", marker: "none", radius: 0, imageFit: "none",
  },

  /** Warm dotted ground, soft cards, centred — the friendly explainer. */
  softserve: {
    label: "Soft", blurb: "Warm dotted ground, rounded cards, centred — friendly explainer",
    bg: "#FFF6F0", texture: "dots", textureColor: "rgba(230,130,90,0.16)",
    ink: "#2B1A14", body: "#5C463C", muted: "#A08B80", accent: "#F4713B",
    card: "#FFFFFF", card2: "#FFE9DE", deep: "#2B1A14", onDeep: "#FFF6F0",
    headFace: "sans", bodyFace: "sans", headWeight: 700,
    align: "center", marker: "chip", radius: 26, imageFit: "band",
  },

  /**
   * Walkthrough — the tutorial deck. Deep teal cover, light stone content
   * slides, serif throughout, numbered steps, and the screenshot sitting UNDER
   * the instruction it proves. The screenshots are the whole argument of a deck
   * like this, so it is the one style that is worth far more with uploads than
   * without.
   */
  walkthrough: {
    label: "Walkthrough", blurb: "Teal and stone, serif, numbered steps with the screenshot under each one",
    bg: "#E6E6E3", texture: "none",
    ink: "#0C3B37", body: "#0C3B37", muted: "#6E7F7C", accent: "#C7402F",
    card: null, card2: "#DCDCD8", deep: "#0C3B37", onDeep: "#FFFFFF",
    headFace: "serif", bodyFace: "serif", headWeight: 700,
    align: "left", marker: "inline", radius: 0,
    imageFit: "bottom", wordmark: true, signature: true,
  },

  /** Near-black with a single cold accent — the "quiet authority" look. */
  onyx: {
    label: "Onyx", blurb: "Near-black with one cold accent — quiet authority",
    bg: "#131417", texture: "none",
    ink: "#F5F6F8", body: "#B4B9C2", muted: "#6E747E", accent: "#7DA7FF",
    card: "#1B1D22", card2: "#20242B", deep: "#0A0B0D", onDeep: "#F5F6F8",
    headFace: "sans", bodyFace: "sans", headWeight: 700,
    align: "left", marker: "rule", radius: 14, imageFit: "bleed",
  },
};

export type LabStyleName = keyof typeof LAB_STYLES;
