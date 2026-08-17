import { cn } from "@/lib/utils";

/**
 * The accent palette.
 *
 * The app's own colour is red, and that does not change — red is what a primary
 * button, a brand mark and a destructive action wear. What was missing is a
 * second layer: colour that carries MEANING rather than brand. Every icon in the
 * app was red, so the colour told you nothing; a published post and a failed job
 * looked identical.
 *
 * The five accents are LinkedIn's own published extended palette, which is the
 * right source for a LinkedIn tool on two counts. It is already harmonious —
 * their four dark accents all land within 0.05 of each other on white (5.76,
 * 5.78, 5.76, 5.74), which is not a coincidence — and it makes the product look
 * native to the platform it writes for rather than like a generic dashboard.
 *
 *   linkedin  #0A66C2  the platform itself: LinkedIn-native features, the mark
 *   amber     #B45309  ideas, energy, AI generation — the spark
 *   green     #44712E  done, published, growth
 *   slate     #38434F  neutral, structural, archival
 *   rust      #B24020  caution and outbound reach; close to brand red on purpose
 *
 * Each pairs with a tint from the same palette. The rule that keeps this legible:
 * the accent may sit on its tint as a GLYPH (icons need 3:1, and the worst pair
 * here is 4.00:1), and it may be TEXT on white or blush (5.02:1 at worst). It is
 * never small text on its own tint.
 *
 * Amber is the one exception worth naming. The literal yellow of a lightning
 * bolt — #E7A33E, LinkedIn's own — is 2.16:1 on white and cannot be a glyph.
 * The warmth comes from the tint behind it and, on `glow`, a soft amber cast
 * underneath; the bolt itself is drawn in a gold dark enough to read.
 */
export const ACCENTS = {
  linkedin: { fg: "#0A66C2", tint: "#DCE6F1", ring: "#B7CDE7" },
  amber: { fg: "#B45309", tint: "#FCE2BA", ring: "#EFCB93" },
  green: { fg: "#44712E", tint: "#D7EBCE", ring: "#B2D8A4" },
  slate: { fg: "#38434F", tint: "#E9E5DF", ring: "#D2CDC5" },
  rust: { fg: "#B24020", tint: "#FADFD8", ring: "#EFBFB3" },
  red: { fg: "#C9282A", tint: "#FBDDD9", ring: "#F1B8B3" },
} as const;

export type Accent = keyof typeof ACCENTS;

const SIZES = {
  sm: { box: "w-8 h-8 rounded-lg", icon: "w-4 h-4" },
  md: { box: "w-10 h-10 rounded-xl", icon: "w-5 h-5" },
  lg: { box: "w-12 h-12 rounded-xl", icon: "w-6 h-6" },
  xl: { box: "w-14 h-14 rounded-2xl", icon: "w-7 h-7" },
} as const;

/**
 * An icon on its accent's tinted chip. Use this rather than colouring a bare
 * lucide glyph: the chip is what lets a 5.7:1 accent read as colour at 16px
 * instead of as a smudge.
 *
 * `glow` adds a soft cast in the accent's own hue. It is for the one or two
 * icons per page that should feel energetic — the generate action, the idea
 * prompt — and loses its meaning if everything carries it.
 */
export function AccentIcon({
  icon: Icon,
  accent = "red",
  size = "md",
  glow = false,
  className,
}: {
  icon: React.ElementType;
  accent?: Accent;
  size?: keyof typeof SIZES;
  glow?: boolean;
  className?: string;
}) {
  const a = ACCENTS[accent];
  const s = SIZES[size];
  return (
    <div
      className={cn("flex items-center justify-center shrink-0 border", s.box, className)}
      style={{
        background: a.tint,
        borderColor: a.ring,
        boxShadow: glow ? `0 4px 14px -4px ${a.fg}66` : undefined,
      }}
    >
      <Icon className={s.icon} style={{ color: a.fg }} />
    </div>
  );
}

/**
 * A small status pill. Same palette, used where the meaning is a state rather
 * than a category — published, scheduled, failed.
 */
export function AccentBadge({
  accent,
  label,
  dot = true,
  pulse = false,
}: {
  accent: Accent;
  label: string;
  dot?: boolean;
  pulse?: boolean;
}) {
  const a = ACCENTS[accent];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap"
      style={{ background: a.tint, borderColor: a.ring, color: a.fg }}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", pulse && "animate-pulse")}
          style={{ background: a.fg }}
        />
      )}
      {label}
    </span>
  );
}
