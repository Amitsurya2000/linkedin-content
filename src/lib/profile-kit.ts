import { GoogleGenAI } from "@google/genai";
import { profileToContext, type CreatorProfileData } from "./resume";
import type { BannerVisual } from "./banner";

/**
 * Profile Kit — the three LinkedIn assets a recruiter consumes in their first
 * 30 seconds, generated as ONE system so they tell a single story: the banner
 * they see, the headline they scan, the About they read.
 *
 * The rules encoded here come from the positioning workbook: tagline is a POV
 * not a title, headline carries quantified proof, About follows a fixed
 * 5-paragraph architecture and stays under 1,600 characters.
 */

export interface ProfileKit {
  banner: {
    tagline: string;
    pillars: string[];
    name: string;
    email?: string;
    visual: BannerVisual;
    visualConcept: string;
    layout: { left: string; center: string; right: string };
  };
  headlines: { text: string; why: string; whenToUse: string; recommended?: boolean }[];
  about: { text: string; characterCount: number };
  alignment: string[];
  refine: string[];
}

const SYSTEM = `You are a LinkedIn personal-branding strategist who positions senior professionals for VP, CXO and Head-level roles. You know how hiring managers and executive recruiters evaluate a profile in seven seconds. You write with authority and without jargon.

BANNED WORDS — never use any of these, in any asset: passionate, seasoned, results-driven, proven track record, leveraging, synergies, dynamic, thought leader, guru, ninja, rockstar, "open to opportunities", "seeking opportunities".

You produce THREE assets that must work as ONE system. A recruiter seeing Banner → Headline → About must get a clear, consistent picture within 30 seconds.

=== ASSET 1: BANNER (1584 x 396) ===
- tagline: MAX 8 WORDS. A bold POV or philosophy, NOT a job title. It should spark curiosity. Good: "From Customer Insight to Business Foresight". Bad: "Senior Financial Analyst | Open to Work".
- pillars: EXACTLY 3 capability domains, MAX 3 WORDS EACH. These are what they are known for.
- name: their name.
- email: only if one appears in the inputs; otherwise omit.
- visual: choose ONE of "arc" (flat line bending upward past a pivot — for insight→foresight, growth, turnaround), "layers" (a stack — for systems, platforms, architecture), "signal" (noise resolving into a clean waveform — for data, clarity, analytics), "grid" (scattered dots ordering into one arrow — for operations, standardisation, scale), "path" (the winding real route between two points — for non-linear journeys, transformation).
- visualConcept: one sentence on why that shape restates the tagline.
- layout: what sits in the left / center / right zones. The LEFT zone MUST stay clear for the profile photo.
Rules: under 20 words on the whole banner, readable at mobile size, no corporate clichés.

=== ASSET 2: HEADLINE (max 220 characters) ===
Three options using: [Role/Identity] | [Capability → Outcome] | [Proof with numbers] | [Credential]
- Lead with WHAT they do, not just who they are.
- Include 1-2 quantified proof points drawn from their real profile. Never invent a number.
- Separate with " | ". Must be scannable in 3 seconds. Strictly under 220 characters.
- Rank them; mark exactly one as recommended (the best for an active job search) and explain why each works and when to use it.

=== ASSET 3: ABOUT SECTION (1,400-1,600 characters) ===
Exactly five paragraphs, pure narrative prose, first person, no bullets or lists:
1. HOOK (max 2 sentences) — a belief, a tension they resolve, or a counterintuitive insight. Never "I am a..." or "With X years of experience...".
2. WHAT I DO + PROOF (3-4 sentences) — what they do, for whom, and their 2 biggest quantified wins. Name the companies. Include the numbers.
3. SIGNATURE STORY (3-5 sentences) — their best career story as Situation → Deliberate Choice → Action → Result. It must demonstrate a REPEATABLE edge: show judgment, not just execution.
4. MY EDGE (2-3 sentences) — 2-3 signature capabilities framed as a connected system where each reinforces the others, tied to current market relevance.
5. INVITATION (1 sentence) — the TYPE of challenge they want. Never "I'm open to opportunities."
Every paragraph must contain at least one specific detail: a number, a company name, or a concrete example. Target under 1,600 characters including spaces.

Ground everything in the profile provided. If a fact is not in the inputs, leave it out — never invent a number, employer, or outcome.

Return ONLY valid JSON (no markdown, no code fences):
{
  "banner": { "tagline": "", "pillars": ["","",""], "name": "", "email": "", "visual": "arc", "visualConcept": "", "layout": { "left": "", "center": "", "right": "" } },
  "headlines": [ { "text": "", "why": "", "whenToUse": "", "recommended": true } ],
  "about": { "text": "" },
  "alignment": ["how the banner tagline connects to the headline", "where the headline's proof reappears in the About", "how the story supports the claimed capability", "the single target role all three point to"],
  "refine": ["2-3 specific things that would strengthen this further"]
}`;

const VISUALS = new Set<BannerVisual>(["arc", "layers", "signal", "grid", "path"]);

export async function generateProfileKit(params: {
  apiKey: string;
  profile: CreatorProfileData;
  /** Free-text steer: target role, company type, industry, stage. */
  targetRole?: string;
  email?: string;
}): Promise<ProfileKit> {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

  const input = [
    profileToContext(params.profile),
    params.targetRole ? `\nTARGET ROLE & COMPANY TYPE: ${params.targetRole}` : "",
    params.email ? `\nEMAIL: ${params.email}` : "",
    "\nNow produce the Profile Kit JSON.",
  ].join("\n");

  const res = await genai.models.generateContent({
    model: "gemini-3.6-flash",
    config: { systemInstruction: SYSTEM, temperature: 0.7, responseMimeType: "application/json" },
    contents: [{ role: "user", parts: [{ text: input }] }],
  });

  const raw = (res.text || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(raw) as ProfileKit;
  return normalize(parsed, params.profile, params.email);
}

/** Clamp the model's output to what the renderer and LinkedIn actually accept. */
function normalize(k: ProfileKit, profile: CreatorProfileData, email?: string): ProfileKit {
  const b = k.banner ?? ({} as ProfileKit["banner"]);
  const pillars = (b.pillars ?? []).map((p) => String(p).trim()).filter(Boolean).slice(0, 3);
  const about = String(k.about?.text ?? "").trim();

  return {
    banner: {
      // 8 words is the readability ceiling at mobile crop, so it is enforced
      // here rather than trusted to the prompt.
      tagline: String(b.tagline ?? profile.headline ?? "").split(/\s+/).slice(0, 8).join(" "),
      pillars,
      name: String(b.name ?? profile.fullName ?? "").trim(),
      email: (b.email || email || "").trim() || undefined,
      visual: VISUALS.has(b.visual) ? b.visual : "arc",
      visualConcept: String(b.visualConcept ?? "").trim(),
      layout: {
        left: b.layout?.left ?? "Left clear for the profile photo.",
        center: b.layout?.center ?? "Tagline, pillars, name.",
        right: b.layout?.right ?? "Line diagram.",
      },
    },
    headlines: (k.headlines ?? []).slice(0, 3).map((h, i) => ({
      text: String(h.text ?? "").slice(0, 220),
      why: String(h.why ?? ""),
      whenToUse: String(h.whenToUse ?? ""),
      recommended: h.recommended ?? i === 0,
    })),
    about: { text: about, characterCount: about.length },
    alignment: (k.alignment ?? []).map(String),
    refine: (k.refine ?? []).map(String),
  };
}
