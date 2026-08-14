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

Write these 4 sequences:
1. Hiring manager at a target company — no mutual connection.
2. Warm intro request to a mutual connection, asking to be introduced.
3. Someone whose post they genuinely engaged with first.
4. Re-activating a dormant contact from a previous job or school.

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

Choose 4 items that together prove the claim their headline makes. Good candidates: a signature post or carousel, a case study, a tool/resource worth downloading, a talk or article, a portfolio piece. Each item needs a cover image, so give it cover copy.

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

/** Kinds that need the relationship-building playbook in context. */
const NEEDS_PLAYBOOK = new Set<AssetKind>(["comments", "dms"]);

export async function generateAsset(params: {
  apiKey: string;
  kind: AssetKind;
  profile: CreatorProfileData;
  /** Free-text steer: the topic, the target company, the audience. */
  brief?: string;
}): Promise<AssetResult> {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

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
      systemInstruction: PROMPTS[params.kind],
      temperature: 0.8,
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

  return { kind: params.kind, data } as AssetResult;
}
