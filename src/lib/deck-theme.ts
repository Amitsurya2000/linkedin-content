/**
 * Palettes and icons for the editorial deck renderer.
 *
 * Separate from koyopo.ts on purpose. KOYOPO is a locked brand system — one red,
 * no images, ten fixed templates. This is the opposite: multi-colour, illustrated,
 * varied per slide, closer to the Supergrow / Sprout Social / Career Sherpa look.
 * Both renderers stay available; they are different products, not versions.
 */

export interface Palette {
  /** Dominant brand colour — headers, bars, filled shapes. */
  primary: string;
  /** Deeper shade for full-bleed cover panels and high-contrast blocks. */
  deep: string;
  /** Very light wash for card fills and alternating rows. */
  tint: string;
  /** Contrasting highlight for a second data series or a callout. */
  accent: string;
  /** Third colour, used sparingly in charts and icon grids. */
  third: string;
  ink: string;
  muted: string;
  white: string;
}

export const PALETTES: Record<string, Palette> = {
  indigo: { primary: "#4F46E5", deep: "#1E1B4B", tint: "#EEF2FF", accent: "#F59E0B", third: "#06B6D4", ink: "#111827", muted: "#6B7280", white: "#FFFFFF" },
  teal:   { primary: "#0D9488", deep: "#134E4A", tint: "#ECFDF5", accent: "#F97316", third: "#6366F1", ink: "#111827", muted: "#6B7280", white: "#FFFFFF" },
  coral:  { primary: "#E11D48", deep: "#4C0519", tint: "#FFF1F2", accent: "#0EA5E9", third: "#F59E0B", ink: "#111827", muted: "#6B7280", white: "#FFFFFF" },
  ocean:  { primary: "#0284C7", deep: "#0C243B", tint: "#F0F9FF", accent: "#FACC15", third: "#10B981", ink: "#111827", muted: "#6B7280", white: "#FFFFFF" },
  forest: { primary: "#15803D", deep: "#14281D", tint: "#F0FDF4", accent: "#EA580C", third: "#0891B2", ink: "#111827", muted: "#6B7280", white: "#FFFFFF" },
  violet: { primary: "#7C3AED", deep: "#2E1065", tint: "#F5F3FF", accent: "#10B981", third: "#F43F5E", ink: "#111827", muted: "#6B7280", white: "#FFFFFF" },
};

export type PaletteName = keyof typeof PALETTES;

/**
 * Pick a palette deterministically from a seed (the post id), so regenerating the
 * same deck keeps its colours but different decks look different. Random choice
 * would make a deck change identity every time it was re-rendered.
 */
export function pickPalette(seed: string): { name: PaletteName; palette: Palette } {
  const names = Object.keys(PALETTES) as PaletteName[];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const name = names[h % names.length];
  return { name, palette: PALETTES[name] };
}

/**
 * Line icons drawn inside a box of side `s` at (x, y), stroked in `c`.
 * Deliberately single-stroke and geometric so they read at small sizes and never
 * compete with the type.
 */
export const ICONS: Record<string, (x: number, y: number, s: number, c: string) => string> = {
  target: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.08}"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.42}"/><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.22}"/><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.05}" fill="${c}"/></g>`,
  bolt: (x, y, s, c) => `<path d="M${x + s * 0.58} ${y + s * 0.06} L${x + s * 0.26} ${y + s * 0.54} L${x + s * 0.47} ${y + s * 0.54} L${x + s * 0.4} ${y + s * 0.94} L${x + s * 0.74} ${y + s * 0.44} L${x + s * 0.52} ${y + s * 0.44} Z" fill="${c}"/>`,
  chart: (x, y, s, c) => `<g fill="${c}"><rect x="${x + s * 0.14}" y="${y + s * 0.52}" width="${s * 0.16}" height="${s * 0.34}" rx="${s * 0.04}"/><rect x="${x + s * 0.42}" y="${y + s * 0.3}" width="${s * 0.16}" height="${s * 0.56}" rx="${s * 0.04}"/><rect x="${x + s * 0.7}" y="${y + s * 0.14}" width="${s * 0.16}" height="${s * 0.72}" rx="${s * 0.04}"/></g>`,
  check: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.1}" stroke-linecap="round" stroke-linejoin="round"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.42}"/><path d="M${x + s * 0.3} ${y + s * 0.52} L${x + s * 0.45} ${y + s * 0.66} L${x + s * 0.71} ${y + s * 0.36}"/></g>`,
  cross: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.1}" stroke-linecap="round"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.42}"/><path d="M${x + s * 0.35} ${y + s * 0.35} L${x + s * 0.65} ${y + s * 0.65} M${x + s * 0.65} ${y + s * 0.35} L${x + s * 0.35} ${y + s * 0.65}"/></g>`,
  gear: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.08}"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.2}"/><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.4}" stroke-dasharray="${s * 0.13} ${s * 0.1}"/></g>`,
  brain: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.08}" stroke-linecap="round"><path d="M${x + s * 0.5} ${y + s * 0.18} a${s * 0.2} ${s * 0.2} 0 0 0 -${s * 0.3} ${s * 0.22} a${s * 0.18} ${s * 0.18} 0 0 0 ${s * 0.06} ${s * 0.34} a${s * 0.2} ${s * 0.2} 0 0 0 ${s * 0.24} ${s * 0.14} Z"/><path d="M${x + s * 0.5} ${y + s * 0.18} a${s * 0.2} ${s * 0.2} 0 0 1 ${s * 0.3} ${s * 0.22} a${s * 0.18} ${s * 0.18} 0 0 1 -${s * 0.06} ${s * 0.34} a${s * 0.2} ${s * 0.2} 0 0 1 -${s * 0.24} ${s * 0.14} Z"/></g>`,
  rocket: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.08}" stroke-linejoin="round"><path d="M${x + s * 0.5} ${y + s * 0.1} c${s * 0.22} ${s * 0.18} ${s * 0.26} ${s * 0.44} ${s * 0.12} ${s * 0.62} l-${s * 0.24} 0 c-${s * 0.14} -${s * 0.18} -${s * 0.1} -${s * 0.44} ${s * 0.12} -${s * 0.62} Z"/><path d="M${x + s * 0.38} ${y + s * 0.5} l-${s * 0.14} ${s * 0.16} l${s * 0.1} ${s * 0.06} M${x + s * 0.62} ${y + s * 0.5} l${s * 0.14} ${s * 0.16} l-${s * 0.1} ${s * 0.06}"/><circle cx="${x + s * 0.5}" cy="${y + s * 0.36}" r="${s * 0.07}"/></g>`,
  clock: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.08}" stroke-linecap="round"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.42}"/><path d="M${x + s * 0.5} ${y + s * 0.28} L${x + s * 0.5} ${y + s * 0.52} L${x + s * 0.66} ${y + s * 0.6}"/></g>`,
  layers: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.08}" stroke-linejoin="round"><path d="M${x + s * 0.5} ${y + s * 0.14} L${x + s * 0.88} ${y + s * 0.36} L${x + s * 0.5} ${y + s * 0.58} L${x + s * 0.12} ${y + s * 0.36} Z"/><path d="M${x + s * 0.12} ${y + s * 0.58} L${x + s * 0.5} ${y + s * 0.8} L${x + s * 0.88} ${y + s * 0.58}"/></g>`,
  shield: (x, y, s, c) => `<path d="M${x + s * 0.5} ${y + s * 0.1} L${x + s * 0.86} ${y + s * 0.26} L${x + s * 0.86} ${y + s * 0.52} Q${x + s * 0.86} ${y + s * 0.8} ${x + s * 0.5} ${y + s * 0.92} Q${x + s * 0.14} ${y + s * 0.8} ${x + s * 0.14} ${y + s * 0.52} L${x + s * 0.14} ${y + s * 0.26} Z" fill="none" stroke="${c}" stroke-width="${s * 0.08}" stroke-linejoin="round"/>`,
  search: (x, y, s, c) => `<g fill="none" stroke="${c}" stroke-width="${s * 0.09}" stroke-linecap="round"><circle cx="${x + s * 0.44}" cy="${y + s * 0.44}" r="${s * 0.28}"/><path d="M${x + s * 0.64} ${y + s * 0.64} L${x + s * 0.86} ${y + s * 0.86}"/></g>`,
};

const ICON_CYCLE = ["target", "bolt", "chart", "layers", "rocket", "gear", "brain", "shield", "clock", "search"];

/** Stable icon per card index, so a deck's icons don't reshuffle on re-render. */
export function iconFor(index: number): string {
  return ICON_CYCLE[index % ICON_CYCLE.length];
}
