import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { profileToContext, type CreatorProfileData } from "./resume";

/**
 * Everything-else generator — the LinkedIn assets that are not posts.
 *
 * Newsletter issues, comment templates, DM sequences, company-page copy,
 * Featured-section entries and video scripts. All of it runs on the same Gemini
 * key the rest of the app uses; nothing here needs a second provider.
 */

function loadKnowledge(relPath: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
  } catch {
    return "";
  }
}

// Only loaded for outreach kinds — it is a large file and irrelevant to the rest.
const relationshipPlaybook = loadKnowledge("src/lib/knowledge/relationship-building.md");

export type AssetKind =
  | "newsletter"
  | "comments"
  | "dms"
  | "companyPage"
  | "featured"
  | "videoScript";

export const ASSET_KINDS: { kind: AssetKind; label: string; blurb: string }[] = [
  { kind: "newsletter", label: "Newsletter issue", blurb: "A full LinkedIn newsletter issue with a cover you can download." },
  { kind: "comments", label: "Comment templates", blurb: "Comments that get you noticed on other people's posts." },
  { kind: "dms", label: "DM & connection sequences", blurb: "Connection notes and follow-up DMs, grounded in real research." },
  { kind: "companyPage", label: "Company page copy", blurb: "Tagline, About, and a week of page posts." },
  { kind: "featured", label: "Featured section", blurb: "The 3–4 items pinned at the top of your profile, with covers." },
  { kind: "videoScript", label: "Video script", blurb: "A 45–70 second talking-head script with a shot list." },
];

// ── Output shapes ────────────────────────────────────────────────────────────

export interface NewsletterIssue {
  title: string;
  subtitle: string;
  coverHeadline: string;
  hook: string;
  sections: { heading: string; body: string }[];
  takeaway: string;
  cta: string;
  subjectLines: string[];
}

export interface CommentPack {
  comments: {
    scenario: string;
    postType: string;
    text: string;
    why: string;
  }[];
}

export interface DmPack {
  sequences: {
    name: string;
    target: string;
    research: string;
    steps: { stage: string; timing: string; text: string; charCount?: number }[];
  }[];
}

export interface CompanyPageCopy {
  tagline: string;
  about: string;
  specialties: string[];
  posts: { day: string; angle: string; text: string }[];
}

export interface FeaturedPack {
  items: { title: string; subtitle: string; kind: string; why: string; coverHeadline: string; coverKicker: string }[];
}

export interface VideoScript {
  title: string;
  hookLine: string;
  script: { t: string; spoken: string; onScreen: string; shot: string }[];
  caption: string;
  hashtags: string[];
}

export type AssetResult =
  | { kind: "newsletter"; data: NewsletterIssue }
  | { kind: "comments"; data: CommentPack }
  | { kind: "dms"; data: DmPack }
  | { kind: "companyPage"; data: CompanyPageCopy }
  | { kind: "featured"; data: FeaturedPack }
  | { kind: "videoScript"; data: VideoScript };

// ── Prompts ──────────────────────────────────────────────────────────────────

const VOICE = `You write for a specific professional, in their voice, grounded in their real experience. You never use: passionate, seasoned, results-driven, proven track record, leveraging, synergies, thought leader, "open to opportunities", "I hope this finds you well", "I wanted to reach out". You never invent a number, employer, client or outcome that is not in the profile. Specific beats polished every time.`;

const PROMPTS: Record<AssetKind, string> = {
  newsletter: `${VOICE}

Write ONE LinkedIn newsletter issue. A newsletter issue is longer and more considered than a post: it earns a subscription by teaching something the reader can act on.

Rules:
- title: max 60 characters. Concrete and specific — a promise, not a topic.
- coverHeadline: max 45 characters, for the cover image. Even shorter than the title.
- hook: 2 sentences that open the issue. A tension or a counterintuitive observation. Never "In today's issue...".
- sections: 3-5. Each heading is max 60 chars; each body is 90-160 words of real substance with at least one concrete detail (a number, a tool, a named situation) drawn from the profile.
- takeaway: one sentence the reader could repeat to a colleague.
- cta: an invitation tied to the topic, not "subscribe for more".
- subjectLines: 3 alternatives, max 55 chars each.

Return ONLY JSON: {"title":"","subtitle":"","coverHeadline":"","hook":"","sections":[{"heading":"","body":""}],"takeaway":"","cta":"","subjectLines":["","",""]}`,

  comments: `${VOICE}

Write 10 LinkedIn COMMENT templates this person can leave on other people's posts. Commenting is the highest-leverage, lowest-cost visibility move on LinkedIn, and most people do it badly ("Great post!", "Well said").

A comment that works does ONE of these:
- adds a specific counter-example from your own experience
- supplies the number or mechanism the post left out
- respectfully disagrees with a named reason
- extends the idea one step further than the author took it
- asks a question only a practitioner would think to ask

Rules:
- 25-60 words each. Long enough to carry substance, short enough to read in the feed.
- Each must be grounded in THIS person's real expertise, with a placeholder like [your number] only where the specific detail changes per post.
- Cover a spread of scenarios: a post by a hiring manager in their field, a contrarian take they disagree with, a data post, a junior person's post, a peer's win, a post that is subtly wrong, an industry news post.
- Never open with "Great post" or "Couldn't agree more".

Return ONLY JSON: {"comments":[{"scenario":"","postType":"","text":"","why":""}]}`,

  dms: `${VOICE}

Write 4 outreach SEQUENCES for LinkedIn: connection note plus follow-ups.

The single rule that governs all of it: research first, and open with something specific to THEM. A message that could have been sent to a hundred people gets treated like it was. Anything they have shared professionally is fair game — their posts, their company's announcements, a talk, an article, their career path. Personal information informs the TONE you use, never the content you cite.

The four targets to write for are named in THIS RUN'S ANGLE below. Write those four and no others.

Each sequence:
- research: what to look up before sending, in one line. Be concrete about where to look.
- steps: 3 stages — the connection note (STRICTLY under 300 characters, LinkedIn's limit), a follow-up after acceptance, and a value-add follow-up 7-10 days later.
- Never ask for a job in the first message. Never ask for "15 minutes to pick your brain" as an opener.
- The third step should GIVE something: a relevant resource, an introduction, a useful observation.

Return ONLY JSON: {"sequences":[{"name":"","target":"","research":"","steps":[{"stage":"","timing":"","text":""}]}]}`,

  companyPage: `${VOICE}

Write LinkedIn COMPANY PAGE copy for the business or practice this person runs or would run, based on their expertise.

- tagline: max 120 characters. What the company does and for whom.
- about: 900-1,400 characters. What it does, who it serves, the proof, and how it works. Narrative prose, no bullet lists.
- specialties: 6-10 short capability phrases.
- posts: 5 page posts, one per weekday. Each with the day, the strategic angle, and the full post text (100-180 words). A company page posts differently from a person: less confession, more evidence, customer outcomes and process transparency.

Return ONLY JSON: {"tagline":"","about":"","specialties":[""],"posts":[{"day":"","angle":"","text":""}]}`,

  featured: `${VOICE}

Design this person's LinkedIn FEATURED section — the 3-4 items pinned at the top of the profile, directly under About. It is the most-viewed real estate on a profile after the headline, and most people leave it empty or fill it with random links.

Choose 4 items that together prove the claim their headline makes. THIS RUN'S ANGLE below names the mix to build — follow it. Each item needs a cover image, so give it cover copy.

- title: max 55 characters, what a visitor sees.
- subtitle: max 90 characters of context.
- kind: post / carousel / link / document / media.
- why: one line on what this item proves about them.
- coverHeadline: max 38 characters — this is printed large on the cover image.
- coverKicker: max 22 characters, uppercase-friendly label (e.g. "CASE STUDY").

Return ONLY JSON: {"items":[{"title":"","subtitle":"","kind":"","why":"","coverHeadline":"","coverKicker":""}]}`,

  videoScript: `${VOICE}

Write a 45-70 second LinkedIn talking-head VIDEO script. LinkedIn video is watched on mute first, so every beat needs on-screen text that carries the meaning without audio.

- hookLine: the first 3 seconds, spoken AND on screen. Under 10 words. It must state a claim or a number, never "Hi, I'm X".
- script: 6-9 beats. Each with:
  - t: the timecode range ("0:00-0:03")
  - spoken: what they say, written the way people talk, 1-2 sentences
  - onScreen: the text burned on screen for that beat, under 8 words
  - shot: the framing or B-roll note, one short phrase
- Total spoken text must be realistically speakable in 45-70 seconds (roughly 120-180 words).
- End on one specific ask, not "let me know your thoughts".
- caption: the post copy that goes with the video, 60-120 words.
- hashtags: 3-5, no generic ones like #motivation.

Return ONLY JSON: {"title":"","hookLine":"","script":[{"t":"","spoken":"","onScreen":"","shot":""}],"caption":"","hashtags":[""]}`,
};

/**
 * A named angle per kind, rotated on every press of Generate.
 *
 * The prompts above are constants, so two runs of the same tab used to differ
 * only by temperature — which rewords a piece, it does not rethink it. You got
 * the same newsletter shape, the same five weekday posts, and, because the DM
 * prompt listed its four targets in the prompt itself, literally the same four
 * targets every time anyone ever pressed the button.
 *
 * This is the mechanism the post generator already uses for hook archetypes and
 * deck types, for the reason proved there: naming ONE angle explicitly beats
 * asking for "something different" and hoping. Asking produces the model's
 * favourite answer with fresh adjectives; naming produces a different piece.
 *
 * Rotation is by index, not random, so pressing Generate four times walks four
 * distinct angles instead of possibly landing on the same one twice.
 */
const ANGLES: Record<AssetKind, string[]> = {
  newsletter: [
    "TEARDOWN — take one real artefact apart (a job description, a pitch, a dashboard, a process) and rebuild it in front of the reader. Sections are the stages of the rebuild.",
    "CONTRARIAN BRIEF — argue against the consensus position in this field. Name the consensus in the hook, then dismantle it. The takeaway must be something most peers would push back on.",
    "THE NUMBERS ISSUE — build the whole issue around three specific figures from the profile. Every section starts from a number and explains what it actually means in practice.",
    "PLAYBOOK — a procedure the reader can run this week. Sections are numbered steps with the decision point and the failure mode at each one.",
    "POST-MORTEM — something that did not work. Open inside the failure, spend the middle on the mechanism that caused it, and end on what is done differently now.",
    "FIELD NOTES — what has changed in this field in the last 90 days, and what a practitioner should do about it. Concrete and dated, never trend-piece vague.",
  ],
  comments: [
    "Weight the pack towards COUNTER-EXAMPLES: most comments should contradict the post with a specific case from this person's own work.",
    "Weight the pack towards SUPPLYING THE MISSING MECHANISM: the post asserts a result, the comment explains how it actually happens.",
    "Weight the pack towards RESPECTFUL DISAGREEMENT: name the specific thing that is wrong and why, without hedging it into meaninglessness.",
    "Weight the pack towards EXTENDING THE IDEA: take the author's point one concrete step further than they took it.",
    "Weight the pack towards PRACTITIONER QUESTIONS: questions only someone who has actually done the work would think to ask.",
    "Weight the pack towards DATA AND SCALE: comments for posts that quote a statistic, a benchmark or a survey, where the value is context on the number.",
  ],
  dms: [
    "Targets: (1) a hiring manager at a target company, no mutual connection. (2) a warm intro request to a mutual connection. (3) someone whose post they genuinely engaged with first. (4) a dormant contact from a previous job or school.",
    "Targets: (1) someone who just changed jobs into a relevant role. (2) a peer doing the same job at a company they admire. (3) a speaker or panellist from an event they attended. (4) a recruiter who reached out before, being re-opened on this person's terms.",
    "Targets: (1) a founder or director two levels above them in an adjacent company. (2) someone hiring for a role they will NOT take but can refer someone into. (3) an author whose article they can add a real correction to. (4) a former manager being re-activated with a specific update.",
    "Targets: (1) a hiring manager who just posted about a problem this person solves. (2) a mutual connection's colleague, approached through the mutual. (3) someone whose company just announced something relevant. (4) a peer they were in a cohort, course or community with.",
    "Targets: (1) an internal referrer at a target company, not the hiring manager. (2) a person who commented on the same post they did. (3) a vendor or partner in their space with a shared client type. (4) someone they turned down or lost a deal to, reopened cleanly.",
  ],
  companyPage: [
    "This week's page strategy is PROOF: every post shows a result, an artefact or a before/after, and nothing is claimed without something behind it.",
    "This week's page strategy is PROCESS TRANSPARENCY: show how the work is actually done, including the unglamorous parts and the decision points.",
    "This week's page strategy is CUSTOMER OUTCOMES: each post is anchored on a client situation and what changed for them, told without naming anyone the profile does not name.",
    "This week's page strategy is POINT OF VIEW: the company's stated position on how this work should be done, and what it refuses to do.",
    "This week's page strategy is EDUCATION: each post teaches one thing a buyer needs to understand before they can buy well.",
  ],
  featured: [
    "Mix: one signature post or carousel, one case study, one downloadable tool or template, one talk or article.",
    "Mix: two case studies from different problem types, one framework or method they own by name, one proof-of-craft artefact.",
    "Mix: one 'start here' explainer of what they do, one result with numbers, one teaching resource, one piece of third-party validation (a talk, a feature, a testimonial).",
    "Mix: one contrarian piece that states their position, one worked example that backs it, one tool that makes it usable, one way to get in touch that is not 'DM me'.",
    "Mix: one portfolio piece, one written breakdown of how it was made, one resource for people who want to do it themselves, one signature post.",
  ],
  videoScript: [
    "Format: SINGLE-CLAIM EXPLAINER — one assertion in the first 3 seconds, then the argument for it, then the ask.",
    "Format: WALKTHROUGH — show a thing being done step by step. On-screen text labels each step; the shot notes carry a screen recording or over-the-shoulder framing.",
    "Format: MYTH-BUST — state the common belief, show why it is wrong, replace it with what is true.",
    "Format: STORY — open inside a specific moment, hold the tension to the middle, and land the lesson only at the end.",
    "Format: THE NUMBER — the whole video hangs off one figure. State it, break it down, say what to do about it.",
    "Format: TEARDOWN — critique a real artefact on screen, marking what works and what does not.",
  ],
};

/** Kinds that need the relationship-building playbook in context. */
const NEEDS_PLAYBOOK = new Set<AssetKind>(["comments", "dms"]);

export async function generateAsset(params: {
  apiKey: string;
  kind: AssetKind;
  profile: CreatorProfileData;
  /** Free-text steer: the topic, the target company, the audience. */
  brief?: string;
  /**
   * Which angle to take. The client passes a counter that increments on each
   * press, so successive generations walk the list instead of re-rolling and
   * sometimes landing on the same angle twice.
   */
  variant?: number;
}): Promise<AssetResult & { angle: string }> {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

  const angles = ANGLES[params.kind];
  const angle = angles[Math.abs(Math.trunc(params.variant ?? 0)) % angles.length];

  const parts: string[] = [profileToContext(params.profile)];
  if (params.brief) parts.push(`\nBRIEF FROM THE USER: ${params.brief}`);
  if (NEEDS_PLAYBOOK.has(params.kind) && relationshipPlaybook) {
    // Trimmed: the playbook is a full course transcript and only the approach
    // matters here, not every worked example.
    parts.push(`\n---\n\n${relationshipPlaybook.slice(0, 60000)}`);
  }
  parts.push("\nNow produce the JSON.");

  const res = await genai.models.generateContent({
    model: "gemini-3.6-flash",
    config: {
      // The angle goes last so it is the freshest instruction before generation,
      // and is stated as a requirement rather than a suggestion — a preference
      // gets averaged away against a prompt this long.
      systemInstruction: `${PROMPTS[params.kind]}\n\n---\n\n## THIS RUN'S ANGLE — this is a requirement, not a suggestion\n${angle}\n\nDo not hedge back towards the safe, general version of this piece. If the angle rules out your first instinct, that is the point of it.`,
      temperature: 0.9,
      responseMimeType: "application/json",
    },
    contents: [{ role: "user", parts: [{ text: parts.join("\n") }] }],
  });

  const raw = (res.text || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const data = JSON.parse(raw);

  // Connection notes over LinkedIn's 300-character limit are silently rejected
  // by the platform, so the count is attached here rather than left to the eye.
  if (params.kind === "dms" && data?.sequences) {
    for (const seq of data.sequences) {
      for (const step of seq.steps ?? []) {
        step.charCount = String(step.text ?? "").length;
      }
    }
  }

  // The angle comes back so the UI can name which take this is — otherwise a
  // second press looks like it did nothing until you read the whole thing.
  return { kind: params.kind, data, angle } as AssetResult & { angle: string };
}
