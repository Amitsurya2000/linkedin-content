/**
 * DYNAMIC CAROUSEL PROMPT BUILDER
 *
 * A fresh prompt is built on every render, and the variation is forced in CODE
 * rather than left to the model's mood: the angle, the hook formula and the
 * visual theme are drawn here, excluding whatever the last few renders used,
 * and handed to the model as non-negotiable direction.
 *
 * This replaces the static prompt file that used to live in
 * `src/lib/prompts/`. There are no carousel copy rules anywhere else in the
 * codebase — the three decks and the directives below are the whole spec.
 *
 * The browser original kept its history in localStorage. On the server that
 * job belongs to the database, so `buildCarouselPrompt` takes the history as an
 * argument and `src/app/api/generate/route.ts` supplies it from past posts.
 */
import { generateWithRetry } from "./gemini";

export interface AngleDef {
  id: string;
  directive: string;
}

export const ANGLES: AngleDef[] = [
  {
    id: "MISTAKES",
    directive:
      "Frame the entire carousel as costly MISTAKES the reader is making right now. Each content slide = one mistake + the fix in one line.",
  },
  {
    id: "SYSTEM",
    directive:
      "Frame the entire carousel as a step-by-step SYSTEM. Each content slide = one numbered step with a concrete action verb.",
  },
  {
    id: "STORY",
    directive:
      "Frame the entire carousel as a before/after STORY with a real-feeling protagonist. Each content slide = one turning point.",
  },
  {
    id: "MYTH_BUSTER",
    directive:
      "Frame the entire carousel as MYTHS vs REALITY. Each content slide = 'Myth: ...' headline, 'Reality: ...' body.",
  },
  {
    id: "CHECKLIST",
    directive:
      "Frame the entire carousel as a steal-able CHECKLIST. Each content slide = one check item + why skipping it costs money.",
  },
];

export const HOOKS: AngleDef[] = [
  {
    id: "NUMBER_LOSS",
    directive:
      "Slide 1 headline MUST follow: 'Your [thing] is leaking [specific number] every [period]' — adapt words, keep the shape.",
  },
  {
    id: "CONTRARIAN",
    directive:
      "Slide 1 headline MUST attack a common belief: '[Popular advice]? Delete it.' or 'Stop [common practice]. Today.'",
  },
  {
    id: "SPEED_PROMISE",
    directive:
      "Slide 1 headline MUST promise speed: '[Result] in [timeframe]. No [expected requirement].'",
  },
  {
    id: "QUESTION_TRAP",
    directive:
      "Slide 1 headline MUST be an uncomfortable question: 'Why do [group] keep [failing at X]?'",
  },
  {
    id: "BEFORE_AFTER",
    directive:
      "Slide 1 headline MUST show transformation: '[Bad state] → [Good state]. Here's the bridge:'",
  },
];

export interface ThemeDef {
  id: string;
  bg: string;
  accent: string;
  text: string;
  /**
   * Type direction for the compositor.
   *
   * Not in the original table, which named only colours — but the renderer draws
   * the text itself and needs a face to draw it in, so each theme states one
   * rather than silently defaulting every deck to sans.
   */
  font: "serif" | "sans" | "mono";
  imageStyle: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: "CYBERPUNK_DARK",
    bg: "#12141C",
    accent: "#22D3EE",
    text: "#F2F5FF",
    font: "sans",
    imageStyle:
      "matte charcoal backdrop, very dim pastel cyan-magenta glow from one edge, soft depth of field, low saturation, minimal, flat, restful — never busy or neon-flooded",
  },
  {
    id: "MODERN_MINIMALIST",
    bg: "#FFFFFF",
    accent: "#1D4ED8",
    text: "#111111",
    font: "sans",
    imageStyle:
      "pure white background, one muted deep cobalt flat block, generous whitespace, crisp Swiss composition, soft matte finish, no texture, no gradients",
  },
  {
    id: "DEVELOPER_TERMINAL",
    bg: "#0A0A0A",
    accent: "#10B981",
    text: "#E6EDF3",
    font: "mono",
    imageStyle:
      "matte near-black background, faint muted green ambient glow from one edge, no scanlines, low contrast, minimal and flat, subtle and restful",
  },
  {
    id: "CORPORATE_SLATE",
    bg: "#2F3A46",
    accent: "#F59E0B",
    text: "#F8FAFC",
    font: "serif",
    imageStyle:
      "low-saturation slate grey background, a single desaturated amber accent shape in a corner, matte corporate finish, soft indirect lighting, flat, understated, no texture",
  },
];

/** One past render, as the builder needs to see it. */
export interface RenderChoice {
  angle: string;
  hook: string;
  theme: string;
  /** Which territory of the resume the deck drew from. */
  topic?: string;
  headline?: string;
}

/**
 * How many past renders the builder is shown.
 *
 * Five, because each deck holds five options: remembering more than that
 * exhausts every deck and pickFresh falls back to the full pool anyway.
 */
export const HISTORY_LIMIT = 5;

/**
 * Sampling temperature: 0.95, the top of the usable band.
 *
 * High enough that the narrative angle genuinely moves between renders, and
 * still inside the range where the JSON contract holds. Note that temperature
 * alone never fixed a repeated render here — the topic, angle and theme are
 * drawn in code above, which is what actually forces the change.
 */
export function renderTemperature(): number {
  return 0.95;
}

/** Random, but never what the history already used. Resets once all are spent. */
function pickFresh<T extends { id: string }>(deck: T[], usedIds: string[]): T {
  const fresh = deck.filter((d) => !usedIds.includes(d.id));
  const pool = fresh.length > 0 ? fresh : deck;
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface BuiltPrompt {
  prompt: string;
  choices: { angle: string; hook: string; theme: string; topic: string };
  theme: ThemeDef;
  seed: number;
}

/**
 * Build one render's prompt.
 *
 * @param topicInput topic, or the parsed resume JSON, as a string
 * @param history the last few renders' choices, freshest order irrelevant
 * @param nonce cache-buster that makes each prompt textually unique; supplied
 *        by the caller so this function stays pure and testable
 */
export function buildCarouselPrompt(
  topicInput: string,
  history: RenderChoice[] = [],
  nonce = 0
): BuiltPrompt {
  const usedAngles = history.map((h) => h.angle);
  const usedHooks = history.map((h) => h.hook);
  const usedThemes = history.map((h) => h.theme);
  const usedHeadlines = history.map((h) => h.headline).filter(Boolean) as string[];

  const angle = pickFresh(ANGLES, usedAngles);
  const hook = pickFresh(HOOKS, usedHooks);
  const theme = pickFresh(THEMES, usedThemes);
  // The SUBJECT is always the user's actual topic + resume. Variety across
  // renders comes from the angle, hook and theme drawn above — never from
  // silently swapping the topic for an unrelated one. Keeping a stable topic
  // key lets the history machinery still de-duplicate angles/hooks/themes
  // without ever drifting off the user's brief.
  const topic: AngleDef = {
    id: "USER_TOPIC",
    directive:
      "the user's requested topic and resume — draw ALL substance from the INPUT MATERIAL above. Stay strictly on what they asked to write about.",
  };

  const bannedHeadlines =
    usedHeadlines.length > 0
      ? `\nFORBIDDEN HEADLINES (do not reuse or resemble — max 2 shared words):\n${usedHeadlines
          .map((h) => `- "${h}"`)
          .join("\n")}\n`
      : "";

  const prompt = `
[render_id: ${nonce}]

You are a top-1% LinkedIn carousel ghostwriter and art director. You apply the
MECHANICS of Matt Gray / Sahil Bloom / Will McTighe style carousels to fresh
material. Never copy their content.

TOPIC / INPUT MATERIAL:
${topicInput}

============ FORCED CREATIVE DIRECTION (non-negotiable) ============
Seed for this invocation: ${nonce}. On EVERY invocation you MUST write about
the user's ACTUAL topic and take a completely DIFFERENT angle, hook and design
aesthetic. The subject is fixed — never substitute a different subject — only
the framing, headline and look rotate.

TOPIC — ${topic.id}: ${topic.directive}
  The subject IS the INPUT MATERIAL above: the user's own topic, grounded in
  their resume. Pull real specifics (numbers, projects, roles, industries) from
  it. Do NOT drift to a generic or unrelated subject — the deck must be about
  exactly what the user asked for and nothing else.
ANGLE — ${angle.id}: ${angle.directive}
HOOK  — ${hook.id}: ${hook.directive}
THEME — ${theme.id}: bg ${theme.bg}, accent ${theme.accent}, text ${theme.text}
  Every image_prompt MUST describe THIS palette explicitly, by hex. Never
  return a beige or cream paper background with a red block — that aesthetic is
  retired and repeating it is a failed render.
${bannedHeadlines}
====================================================================

STRUCTURE — 4 OR 5 SLIDES. Default to 5 when the idea has depth.
- Slide 1 HOOK: <=8 words, payoff/pain never topic-label, badge "swipe →"
- Slide 2 CONTEXT: set up the problem or framing. Headline <=8 words, body <=18 words.
- Slide 3 PAYOFF: the single most valuable idea, delivered in full. Headline
  <=8 words, body <=18 words. This is the core substance of the carousel.
- Slide 4 PROOF (optional, use when there's a real number or example):
  evidence, stat, or concrete example. Headline <=8 words, body <=18 words.
- Slide 5 CTA: name + positioning line + "Follow for more" + "Repost" ask

If the idea is simple and has no supporting evidence, use 4 slides by dropping
Slide 4. Every slide must carry real substance — no filler slides.

COPY LAWS:
- Grade-5 reading level. Translate ALL jargon/acronyms into plain outcomes.
- Verbs first. Real numbers from the input only — never invent statistics.
- Banned: leverage, utilize, delve, unlock, elevate, game-changer, unleash,
  transformative, seamless, robust, streamline.
- Exactly ONE *highlighted* phrase per headline = the TENSION phrase (pain,
  number, surprise), never the category word.

IMAGE PROMPTS (per slide, background only):
- Base style: ${theme.imageStyle}
- Name THIS palette by hex inside the prompt: bg ${theme.bg}, accent ${theme.accent}.
- Vary composition per slide: shift light direction, accent shape position,
  texture density — sibling slides, not clones.
- Reserve a large empty zone for text overlay; state its position.
- End EVERY image_prompt with this exact clause, verbatim, and nothing after it.
  The palette prohibition above says what to avoid; this repeats it where the
  image model actually reads it — at the end of its own prompt:
  "flat, minimal, refined, not glossy. NEGATIVE: no beige, no cream paper texture, no torn paper edges, no red vertical rectangles, no low-contrast text, no lettering, no words, no letters, no numbers, no typography, no captions, no watermarks, no logos"

SELF-CHECK before answering (rewrite on any failure):
- Hook != any forbidden headline? Payoff not topic? Every slide <3s readable?
- Zero jargon? Highlight = tension? Recap screenshot-worthy? Real number used?

OUTPUT: single JSON object only, no markdown fences:
{
  "variation_choices": {"seed_used":${nonce},"topic":"${topic.id}","angle":"${angle.id}","hook":"${hook.id}","theme":"${theme.id}"},
  "post_content": "...",
  "hashtags": ["...","...","..."],
  "design_system": {"bg_hex":"${theme.bg}","accent_hex":"${theme.accent}","text_hex":"${theme.text}"},
  "carouselSlides": [ { "slide_number":1, "slide_type":"hook|stakes|content|recap|cta",
    "headline":"...", "body":"... or null", "badge":"... or null",
    "text_layout":"...", "image_prompt":"..." } ]
}
`.trim();

  return {
    prompt,
    choices: { angle: angle.id, hook: hook.id, theme: theme.id, topic: topic.id },
    theme,
    seed: nonce,
  };
}

// ─── Generation ──────────────────────────────────────────────────────────────

export interface CarouselParams {
  apiKey: string;
  topic: string;
  postsCount: number;
  /** The resume-derived Creator Profile, folded into the input material. */
  profileContext?: string;
  targetAudience?: string;
  tonePrefs?: string;
  customInstructions?: string;
  /** The last renders on this topic, so the builder can avoid repeating them. */
  history?: RenderChoice[];
  referenceDocs?: { data: string; mimeType: string; name?: string }[];
  /** Cache-buster supplier. Owned by the caller to keep this module testable. */
  nonceFor: (index: number) => number;
}

/** The deck-level design system, carried through to the renderer. */
export interface DeckDesign {
  bgHex: string;
  accentHex: string;
  textHex: string;
  /** "serif" | "sans" | "mono" — read straight by the compositor. */
  typeDirection: string;
  visualTheme: string;
  /** The forced choices, read back as history on the next render. */
  angle: string;
  hookFormula: string;
  topic: string;
}

export interface CarouselSlide {
  slideNumber: number;
  title: string;
  body: string;
  designDirection: string;
  slideType: "hook" | "stakes" | "content" | "recap" | "cta";
  badge: string | null;
  textLayout: string;
  imagePrompt: string;
  design: DeckDesign;
}

export interface CarouselPost {
  hookCategory: string;
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  whyThisWorks: string;
  variations: string[];
  carouselSlides: CarouselSlide[];
}

interface RawOut {
  variation_choices?: { seed_used?: number; topic?: string; angle?: string; hook?: string; theme?: string };
  post_content?: string;
  hashtags?: unknown;
  design_system?: { bg_hex?: string; accent_hex?: string; text_hex?: string };
  carouselSlides?: {
    slide_number?: number;
    slide_type?: string;
    headline?: string;
    body?: string | null;
    badge?: string | null;
    text_layout?: string;
    image_prompt?: string;
  }[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, fb: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fb);
const str = (v: unknown, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);

/** Strip the *highlight* markers. Slides keep them; plain post copy does not. */
export function stripMarks(text: string): string {
  return (text || "").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
}

const SLIDE_TYPES = ["hook", "stakes", "content", "recap", "cta"] as const;
type SlideType = (typeof SLIDE_TYPES)[number];

/** Infer a slide's role when the model omits it. Position is the only evidence. */
function slideTypeAt(raw: string | undefined, i: number, total: number): SlideType {
  const given = (raw || "").toLowerCase().trim() as SlideType;
  if ((SLIDE_TYPES as readonly string[]).includes(given)) return given;
  if (i === 0) return "hook";
  if (i === total - 1) return "cta";
  if (i === total - 2) return "recap";
  if (i === 1) return "stakes";
  return "content";
}

/**
 * Generate `postsCount` decks.
 *
 * One request per deck: the prompt returns a single object. Each deck's choices
 * and headline join the running history before the next is built, so a batch
 * cannot draw the same angle, hook or theme twice.
 */
export async function generateCarousels(params: CarouselParams): Promise<CarouselPost[]> {
  const history: RenderChoice[] = [...(params.history ?? [])];
  const posts: CarouselPost[] = [];

  for (let i = 0; i < params.postsCount; i++) {
    // Everything the model is given about the subject, as one input block.
    const topicInput = JSON.stringify(
      {
        topic: params.topic,
        resume: params.profileContext || null,
        target_audience: params.targetAudience || null,
        tone: params.tonePrefs || null,
        client_instructions: params.customInstructions || null,
      },
      null,
      2
    );

    const built = buildCarouselPrompt(topicInput, history.slice(-HISTORY_LIMIT), params.nonceFor(i));

    // Reference documents lead, so the model reads the source before the brief.
    const parts: Record<string, unknown>[] = [];
    for (const doc of params.referenceDocs ?? []) {
      parts.push({ inlineData: { mimeType: doc.mimeType, data: doc.data } });
      parts.push({
        text: `The file above is REFERENCE MATERIAL${doc.name ? ` ("${doc.name}")` : ""} supplied by the client. Pull real figures from it.`,
      });
    }
    // The built prompt carries its own role line, so it is sent whole rather
    // than split into a system instruction and a brief.
    parts.push({ text: built.prompt });

    const res = await generateWithRetry({
      apiKey: params.apiKey,
      config: { temperature: renderTemperature(), responseMimeType: "application/json" },
      contents: [{ role: "user", parts }],
    });

    const clean = (res.text || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let raw: RawOut;
    try {
      raw = JSON.parse(clean) as RawOut;
    } catch {
      throw new Error("The carousel model returned something that is not JSON.");
    }
    if (Array.isArray(raw)) raw = (raw[0] ?? {}) as RawOut;

    const post = mapOut(raw, built);
    posts.push(post);
    history.push({ ...built.choices, headline: post.hook });
    void built.seed;
  }

  return posts;
}

/** Map one model answer onto the record shape `generated_posts` already stores. */
function mapOut(raw: RawOut, built: BuiltPrompt): CarouselPost {
  const ds = raw.design_system ?? {};
  const t = built.theme;
  const design: DeckDesign = {
    // The theme was chosen in code, so its hexes are the fallback — the model
    // echoing them back is a confirmation, not the source of truth.
    bgHex: hex(ds.bg_hex, t.bg),
    accentHex: hex(ds.accent_hex, t.accent),
    textHex: hex(ds.text_hex, t.text),
    typeDirection: t.font,
    visualTheme: built.choices.theme,
    angle: built.choices.angle,
    hookFormula: built.choices.hook,
    topic: built.choices.topic,
  };

  const rawSlides = Array.isArray(raw.carouselSlides) ? raw.carouselSlides : [];
  const total = rawSlides.length;
  const slides: CarouselSlide[] = rawSlides.map((s, i) => ({
    slideNumber: typeof s.slide_number === "number" ? s.slide_number : i + 1,
    // The *marks* are KEPT here: the compositor turns them into the accent
    // colour, which is what the highlight law is asking for.
    title: str(s.headline),
    body: str(s.body ?? ""),
    // `designDirection` is the field name the rest of the app reads; here it
    // holds the slide's own background prompt.
    designDirection: str(s.image_prompt),
    slideType: slideTypeAt(s.slide_type, i, total),
    badge: str(s.badge) || null,
    textLayout: str(s.text_layout),
    imagePrompt: str(s.image_prompt),
    // Carried on every slide so the renderer and the history lookup can read it
    // without a new column on `generated_posts`.
    design,
  }));

  const first = slides[0];
  const last = slides[slides.length - 1];
  const postContent = str(raw.post_content);
  const hook = stripMarks(first?.title || postContent.split("\n")[0] || "");

  return {
    hookCategory: built.choices.angle,
    hook,
    body: postContent,
    hashtags: Array.isArray(raw.hashtags)
      ? raw.hashtags.filter((h): h is string => typeof h === "string")
      : [],
    cta: stripMarks(last?.title || "Follow for more"),
    whyThisWorks: `Angle: ${built.choices.angle} · Hook: ${built.choices.hook} · Theme: ${built.choices.theme}`,
    // One deck per render. Variation happens ACROSS renders, forced by the
    // builder, rather than as alternative versions inside one.
    variations: [],
    carouselSlides: slides,
  };
}
