import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// Load the LinkedIn system prompt + the Career OS knowledge base from disk.
// The base prompt sets the ghostwriter role & viral rules; the two knowledge
// files add (1) the Career OS framework library (Trust Engines, Hook Movie
// Trailer, virality frameworks + the ₹1Cr+ India CX/CS/Product positioning) and
// (2) real viral-post patterns distilled from 1,203 top-creator posts.
function loadKnowledge(relPath: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
  } catch {
    return "";
  }
}

const basePrompt = loadKnowledge("src/lib/prompts/linkedin-system-prompt.md");
const contentBrain = loadKnowledge("src/lib/knowledge/career-os-content-brain.md");
const viralPatterns = loadKnowledge("src/lib/knowledge/viral-post-patterns.md");
// 21 real posts, verbatim, pulled from the 1,203-post dataset by engagement
// (top 7 per creator — see scripts/extract-top-posts.js for why it is per-creator
// and not a global sort). Showing the model actual high-performing posts beats
// describing them: this is the only place the dataset's like counts influence
// anything, since nothing else in the app reads them.
const topPostExamples = loadKnowledge("src/lib/knowledge/top-posts-examples.md");
// Verified facts from the creator's CV and public GitHub, plus dated industry
// context. This is the supply of real detail the anti-fabrication rule depends on:
// forbidding invented numbers only works if genuine ones are within reach.
const creatorEvidence = loadKnowledge("src/lib/knowledge/creator-evidence.md");
// KOYOPO slide-writing rules: character budgets and the "Concept — expansion"
// item format the deck templates require. Only loaded for carousels, since it
// is dead weight (and a distraction) on text posts.
const koyopoSlideRules = loadKnowledge("src/lib/knowledge/koyopo-slide-rules.md");
// Layout patterns catalogued from real published LinkedIn carousels — which
// template suits which kind of idea, and how to vary them across a deck.
const carouselPatterns = loadKnowledge("src/lib/knowledge/carousel-design-patterns.md");
// The 18 carousel TYPES with their slide-by-slide spines, plus hook formulas,
// body-copy rhythm and the platform benchmarks. This is what lets the generator
// produce a framework deck or a myth-buster rather than defaulting to a list
// every time.
const carouselMaster = loadKnowledge("src/lib/knowledge/carousel-master.md");

/**
 * The 18 deck types from carousel-master.md. Assigned per post the same way
 * hook archetypes are: naming one explicitly beats asking for "variety" and
 * hoping, which reliably produces three listicles in a row.
 */
const CAROUSEL_TYPES = [
  "LISTICLE / RULES", "STEP-BY-STEP / HOW-TO", "FRAMEWORK", "CASE STUDY",
  "BEFORE / AFTER TRANSFORMATION", "MYTH-BUSTER", "MISTAKES TO AVOID",
  "CONTRARIAN", "DATA STORY", "COMPARISON", "Q&A / OBJECTION HANDLER",
  "CHEAT SHEET", "CHECKLIST", "LESSON FROM FAILURE", "NARRATIVE JOURNEY",
  "TACTICAL PLAYBOOK", "TOOLS / RESOURCE ROUNDUP", "MICRO-INTERVIEW",
] as const;

const systemPrompt = [
  basePrompt,
  contentBrain
    ? `\n\n---\n\n# CAREER OS CONTENT BRAIN (apply these frameworks)\n\n${contentBrain}`
    : "",
  viralPatterns
    ? `\n\n---\n\n# ${viralPatterns}`
    : "",
  creatorEvidence
    ? `\n\n---\n\n${creatorEvidence}`
    : "",
  // Examples go LAST so they are the freshest context when generation starts.
  topPostExamples
    ? `\n\n---\n\n${topPostExamples}`
    : "",
].join("");

// The 9 hook archetypes and 10 post skeletons live in viral-post-patterns.md as
// prose. Prose alone gets averaged away inside a ~19.5k-token system prompt, so
// we assign a specific one to every post and every variation instead of asking
// the model to "use a different hook category" and hoping.
const HOOK_ARCHETYPES = [
  "A. Bold/counterintuitive claim",
  "B. 'You have a problem' callout (accusation hook)",
  "C. News/number peg",
  "D. Credential/contrast flex",
  "E. Time-anchored story open",
  "F. 'How to' promise + value drop",
  "G. Contrarian 'don't' / negative command",
  "H. Labeled-mistake / myth-bust",
  "I. Question hook",
] as const;

const SKELETONS = [
  "Skeleton 1 — Listicle Value-Bomb (400-700 words, structured teaching)",
  "Skeleton 2 — Short Essay / Belief Piece (120-250 words, aphoristic)",
  "Skeleton 3 — Micro-Story Update (40-100 words, build-in-public)",
  "Skeleton 4 — Problem → Agitate → Solution → Proof",
  "Skeleton 5 — Two-Column Contrast",
  "Skeleton 6 — Confession / Vulnerable Arc",
  "Skeleton 7 — Checklist / Self-Audit",
  "Skeleton 8 — System / Routine Prescription",
  "Skeleton 9 — Lead-Magnet Giveaway (comment-to-get)",
  "Skeleton 10 — 'Nothing's Changed' Ironic List",
] as const;

/** Rotate through a list so each post/variation gets a distinct assignment. */
function pick<T>(list: readonly T[], i: number): T {
  return list[i % list.length];
}

interface GenerateLinkedInPostsParams {
  apiKey: string;
  topic: string;
  postType: "text" | "carousel" | "article" | "poll";
  postsCount: number;
  industry?: string;
  targetAudience?: string;
  tonePrefs?: string;
  profileContext?: string; // client's resume-derived Creator Profile (base context)
}

interface LinkedInPost {
  hookCategory: string;
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  whyThisWorks: string;
  variations: string[];
  carouselSlides?: {
    slideNumber: number;
    title: string;
    body: string;
    designDirection: string;
    slideTemplate?: string; // one of the ten KOYOPO templates
    sectionTag?: string; // uppercase, <=30 chars
    takeaway?: string; // the slide's one-line "so what", printed in its own card
  }[] | null;
}

export async function generateLinkedInPosts(params: GenerateLinkedInPostsParams): Promise<LinkedInPost[]> {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

  const userMessage = buildUserPrompt(params);

  const response = await genai.models.generateContent({
    // gemini-3.6-flash, NOT a Pro model. Pro answers a one-off probe with 200 but
    // its sustained free-tier quota is limit:0 (GenerateRequestsPerDayPerProject
    // PerModel-FreeTier), so a single request succeeds and every one after it 429s.
    // Only move to gemini-3.1-pro-preview once billing is enabled on the key, and
    // verify with several consecutive calls rather than one.
    model: "gemini-3.6-flash",
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.85,
      responseMimeType: "application/json",
    },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
  });

  const text = response.text || "";
  // Parse JSON response, handle potential markdown code blocks
  const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const posts: LinkedInPost[] = JSON.parse(cleanText);

  return posts;
}

function buildUserPrompt(params: GenerateLinkedInPostsParams): string {
  let prompt = "";

  // The client's resume-derived profile is the FOUNDATION for all content.
  if (params.profileContext && params.profileContext.trim().length > 0) {
    prompt += `${params.profileContext}\n\n`;
    prompt += `Write every post AS this person — in their voice, using their real experience, achievements, and stories above. Ground the content in their actual background; never write generic advice that any stranger could have written.\n\n`;
    prompt += `----\n\n`;
  }

  prompt += `Generate ${params.postsCount} LinkedIn ${params.postType} post(s) about:\n\n`;
  prompt += `**Topic/Idea:** ${params.topic}\n\n`;

  if (params.industry) {
    prompt += `**Industry:** ${params.industry}\n`;
  }
  if (params.targetAudience) {
    prompt += `**Target Audience:** ${params.targetAudience}\n`;
  }
  if (params.tonePrefs) {
    prompt += `**Tone & Style:** ${params.tonePrefs}\n`;
  }

  prompt += `\n**Post Type:** ${params.postType}\n`;

  // Assign a concrete hook archetype + skeleton to each post, and to each of its
  // 3 variations. Without this the model returns near-identical paraphrases, so
  // the "alternative versions" give the user nothing real to choose between.
  prompt += `\n**Assignments — follow these exactly.** Each post below is locked to one hook archetype and one skeleton from the knowledge base. Do not swap them.\n`;
  for (let i = 0; i < params.postsCount; i++) {
    prompt += `\nPost ${i + 1}: hook = "${pick(HOOK_ARCHETYPES, i)}" | structure = "${pick(SKELETONS, i)}"`;
    prompt += `\n  variations[0]: hook = "${pick(HOOK_ARCHETYPES, i + 3)}" | structure = "${pick(SKELETONS, i + 4)}"`;
    prompt += `\n  variations[1]: hook = "${pick(HOOK_ARCHETYPES, i + 6)}" | structure = "${pick(SKELETONS, i + 7)}"`;
    prompt += `\n  variations[2]: hook = "${pick(HOOK_ARCHETYPES, i + 8)}" | structure = "${pick(SKELETONS, i + 2)}"`;
  }

  prompt += `\n\n**Variations are real alternatives, not paraphrases.** Each of the 3 variations must be a COMPLETE, standalone post that opens with a different first line, uses its assigned structure, and lands at that skeleton's stated word count. If two versions of the same post could be swapped without a reader noticing, you have failed.`;
  prompt += `\n\n**Never invent numbers.** Do not write a statistic, percentage, currency figure, funding amount, study or benchmark unless it appears in the creator profile or the brief above. Real numbers are powerful; fabricated ones are a liability the creator has to defend in the comments and cannot. When you have no real figure, make the point qualitatively — "we rebuilt it twice before it held" beats an invented "28% lift".`;
  prompt += `\n\n**Hook discipline:** the opening line is a standalone sentence under 12 words. In the top-performing posts in your knowledge base, the best hooks average ~40 characters and the worst average ~77. Write short. One idea per line, blank line between beats.`;
  prompt += `\n\n**Important:** Generate exactly ${params.postsCount} unique post(s). Set "hookCategory" to the assigned archetype letter and name. Return a JSON array of post objects.`;

  if (params.postType === "carousel") {
    // 8-10 slides. Published 2026 benchmarks put the sweet spot at 8-12 with sharp
    // completion drop-off past 12; the original cap of 5 also fought the templates,
    // since a cardGrid holds four items and a numbered slide five.
    prompt += `\n\nFor each carousel post, produce the carouselSlides array with 8 to 10 slides. Slide 1 = the cover; the final slide = a clear call-to-action; everything between carries the substance.`;

    // Assigning a distinct deck type per post is what stops a batch of three
    // from coming back as three listicles. Same reasoning as the hook rotation.
    prompt += `\n\n**Each post gets a DIFFERENT carousel type**, and must follow that type's slide-by-slide spine from the CAROUSEL MASTER FILE below:`;
    for (let i = 0; i < params.postsCount; i++) {
      prompt += `\n  Post ${i + 1}: carousel type = "${pick(CAROUSEL_TYPES, i * 5 + params.topic.length)}"`;
    }
    prompt += `\n\nIf an assigned type genuinely cannot carry this topic — a CASE STUDY with no before/after numbers, a DATA STORY with no data — choose the nearest type that the material actually supports, and never fabricate the missing evidence to fit the shape.`;
    prompt += `\n\n**Slide 1 states the payoff, not the topic.** "Your Edge Model Does Not Need INT8" beats "Edge Deployment and Quantization". A numbered promise also works ("10 Rules to 10X Your Output") — but only ever promise a count you actually deliver.`;
    prompt += `\n\n**Slide 2 must immediately deliver the proof** the cover promised — the number, the contrast, the answer. Between a fifth and a third of readers leave between slide 1 and slide 2, so never spend slide 2 on background or a contents list.`;
    prompt += `\n\n**Two deck shapes are available.** The default is the alternating rhythm — never the same template twice in a row. The alternative is the PILLAR deck: 3 named pillars with 3 concrete points each, a divider carrying each pillar name. Use the pillar shape when the topic genuinely splits into 3 memorable buckets; it is the one case where repeating a template is correct, because the repetition IS the structure.`;
    prompt += `\n\n**Fill the templates.** A cardGrid slide needs 3-4 items, a numbered slide needs 4-5, a timeline needs 4-5, a twoColumn needs 3-5 per column. Write those items as separate lines in the slide's "body", one per line. A slide carrying a single sentence where the template expects four items is a wasted slide — either give it the full set or choose a different template.`;
    prompt += `\n\n**Go deep, not broad.** Prefer the specific mechanism over the general claim: name the tool, the failure mode, the trade-off, the number. "Async state wipes across raw HTTP endpoints" earns a slide; "deployment is hard" does not.`;
    prompt += `\n\n**Write the body as short standalone paragraphs, not bullet fragments.** The winning decks read like someone talking: "I used to treat breaks as a reward for finishing the work." / "But the work never really ends, so that meant no breaks at all." / "Now I step away every couple of hours." Each line is one complete thought of 1-2 sentences. Never a noun-phrase fragment, never a heading with a colon.`;
    prompt += `\n\n**Mark ONE phrase per title for highlight** by wrapping it in *asterisks*: "Your month-end close does not need *5 days*". The renderer burns that phrase into a filled accent block on its own line, so it must be 1-4 words and must be the phrase that carries the tension — a number, a name, or the surprising word. Never mark a whole title, and never mark more than one phrase.`;
    prompt += `\n\n**Where the slide is a breakdown of quantities, write the items as "Label — number"** (e.g. "Multi-currency reconciliation — 41"). Those render as a real bar chart, which is the strongest slide in any deck. Use it once when the topic has a genuine split of hours, cost, or share.`;
    prompt += `\n\n**A worksheet slide renders as Q&A.** Write each item as a question followed by its answer: "Do I need Python for this? No. The reconciliation that saved us 3.5 days is pure Excel VBA." Three at most. Use it for the objections the audience actually raises.`;
    prompt += `\n\n**Every content slide needs a "takeaway"** — one sentence, max 110 characters, stating the rule or "so what" the slide proves. It renders in its own highlighted card under the body, and it is what makes the deck skimmable for someone swiping fast. It must NOT restate the title; it must land the lesson ("Most to-do lists fail from addition. Make every new task earn its place.").`;
    prompt += `\n\nEvery slide object must include "slideTemplate" (one of the ten KOYOPO template names), "sectionTag" (uppercase, 30 chars max) and "takeaway" alongside slideNumber, title and body. Obey every character limit in the KOYOPO rules below — the text is printed verbatim onto the image, so anything over budget gets clipped and cannot be fixed afterwards.`;
    // Master file first (types and spines), then layout patterns, then the
    // character budgets — broadest structure to tightest constraint.
    if (carouselMaster) {
      prompt += `\n\n---\n\n${carouselMaster}`;
    }
    if (carouselPatterns) {
      prompt += `\n\n---\n\n${carouselPatterns}`;
    }
    if (koyopoSlideRules) {
      prompt += `\n\n---\n\n${koyopoSlideRules}`;
    }
  }

  if (params.postType === "poll") {
    prompt += `\n\nFor each poll post, include the poll question in the hook, poll options in the body (formatted as numbered list), and context/follow-up in the cta field.`;
  }

  if (params.postType === "article") {
    prompt += `\n\nFor each article, the body should contain the full article outline with section headers (use ## for headers) and key bullet points for each section.`;
  }

  return prompt;
}
