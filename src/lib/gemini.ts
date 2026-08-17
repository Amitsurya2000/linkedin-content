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
// The scorecard a finished deck is graded against: hook formulas, save-rate
// thresholds, and the four failure modes. Used twice — once as guidance during
// generation, once as the rubric for the revision pass.
const winningPlaybook = loadKnowledge("src/lib/knowledge/winning-carousel-playbook.md");

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

/**
 * The hook archetype each tone naturally wants.
 *
 * Archetypes are assigned by index, so a Storytelling post could be handed
 * "bold counterintuitive claim" and open on an assertion rather than a scene —
 * the tone directive and the archetype pulling against each other. The tone wins
 * for the FIRST post; the variations still rotate, so a batch keeps its range.
 */
const TONE_HOOK: Record<string, number> = {
  Professional: 2,   // C. News/number peg
  Conversational: 8, // I. Question hook
  Inspirational: 4,  // E. Time-anchored story open
  Educational: 5,    // F. "How to" promise + value drop
  Provocative: 6,    // G. Contrarian "don't" / negative command
  Storytelling: 4,   // E. Time-anchored story open
};

/**
 * What each tone actually requires, as structural moves.
 *
 * The tone dropdown had no measurable effect while it was a bare label: the same
 * topic under Professional, Provocative and Storytelling produced three posts
 * differing only in which synonym they chose for "expensive software". A tone
 * only bites when it dictates how the post OPENS, how it BUILDS, and what it
 * refuses to do.
 */
const TONE_DIRECTIVES: Record<string, string> = {
  Professional: `- Open on the claim, not on yourself. No warm-up line.
- Short declarative sentences. One idea per line. No rhetorical questions.
- Evidence before opinion: state the number, then what it means.
- No exclamation marks, no emoji, no "I'm excited to share".
- Close on a judgement, not a feeling: what you would do next and why.`,

  Conversational: `- Write the way you would explain it to a colleague at lunch.
- Contractions throughout. Fragments are fine. Second person ("you") often.
- Include one aside or self-interruption — the thing you would actually say out loud.
- Ask one real question mid-post, not as a rhetorical device.
- No corporate register anywhere: not "leverage", not "utilise", not "in order to".`,

  Inspirational: `- Open on the moment it could have gone the other way.
- Earn the lift: the encouraging line only lands AFTER the cost is shown honestly.
- Name what it actually took — hours, doubt, the thing that nearly stopped you.
- Never end on a platitude. End on something specific the reader can do this week.
- Banned: "the sky is the limit", "believe in yourself", "everything happens for a reason".`,

  Educational: `- State what the reader will be able to do by the end, in the first two lines.
- Teach ONE mechanism, in order. Each step must be executable, not conceptual.
- Name the tool, the setting, the exact figure. Vagueness is the failure mode here.
- Include the step where people usually go wrong, and why.
- Close with the smallest first action, not a summary.`,

  Provocative: `- Open by contradicting something this audience currently believes. Say it flatly.
- Do not soften it in the second line. Defend it instead.
- Bring the evidence early — a provocative claim with no proof is just noise.
- Name who is wrong and why they came to believe it. Be specific, never sneering.
- Concede the strongest counter-argument honestly before you close.
- Banned: "unpopular opinion" as an opener. Just state the opinion.`,

  Storytelling: `- Open INSIDE a scene: a specific moment, place or line of dialogue. Not a summary of a scene.
- Past tense, chronological. One thing happens, then the next.
- Keep the tension: do not reveal the outcome in the first line.
- Include the concrete detail that proves you were there — what was on the screen, who said what, what time it was.
- The lesson comes last, in one line, and is never announced ("here's what I learned").`,
};

interface GenerateLinkedInPostsParams {
  apiKey: string;
  topic: string;
  postType: "text" | "carousel" | "article";
  postsCount: number;
  targetAudience?: string;
  tonePrefs?: string;
  profileContext?: string; // client's resume-derived Creator Profile (base context)
  /** Slides per carousel. Defaults to the 8-10 the benchmarks favour. */
  slidesCount?: number;
  /**
   * Optional reference material the post should be built from — a PDF report,
   * a slide deck, a screenshot of a chart, a photo of a whiteboard. Gemini reads
   * PDFs and images natively, so the bytes go straight into the request.
   */
  referenceDocs?: { data: string; mimeType: string; name?: string }[];
  /** Optional free-text direction from the client on what they want back. */
  customInstructions?: string;
  /** Second editing pass against the winning-carousel scorecard. On by default. */
  refine?: boolean;
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

  // Reference documents lead the request: the model should read the source
  // before it reads the brief about what to do with it.
  const parts: Record<string, unknown>[] = [];
  for (const doc of params.referenceDocs ?? []) {
    parts.push({ inlineData: { mimeType: doc.mimeType, data: doc.data } });
    parts.push({ text: `The file above is REFERENCE MATERIAL${doc.name ? ` ("${doc.name}")` : ""} supplied by the client.` });
  }
  parts.push({ text: userMessage });

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
    contents: [{ role: "user", parts }],
  });

  const text = response.text || "";
  // Parse JSON response, handle potential markdown code blocks
  const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const posts: LinkedInPost[] = JSON.parse(cleanText);

  // Carousels get a second pass against the scorecard. Text posts do not: their
  // failure modes differ and the hook rules in the playbook are deck-specific.
  if (params.postType === "carousel" && params.refine !== false) {
    try {
      return await refineCarousels(genai, posts, params.topic);
    } catch (err) {
      // A refinement that fails must never cost the user the deck they have.
      console.error("Carousel refinement failed, returning the draft:", err);
      return posts;
    }
  }

  return posts;
}

/**
 * Second pass: grade the drafted decks against the playbook scorecard and
 * rewrite what fails.
 *
 * One-shot generation reliably produces decks that are *fine* — the hook names
 * the topic instead of the payoff, the takeaway restates the title, the closing
 * slide says "thanks for reading". Those are exactly the faults a model can spot
 * in finished work but rarely avoids while writing it, which is why this is a
 * separate call with the draft in front of it rather than more instructions in
 * the first prompt.
 *
 * Returns the original posts unchanged if the pass fails for any reason: a
 * refinement that errors must never cost the user the deck they already have.
 */
async function refineCarousels(
  genai: GoogleGenAI,
  posts: LinkedInPost[],
  topic: string
): Promise<LinkedInPost[]> {
  const carousels = posts.filter((p) => p.carouselSlides?.length);
  if (!carousels.length || !winningPlaybook) return posts;

  const system = `You are a LinkedIn carousel editor. You are handed finished decks and the standard they are judged against. Your job is to REWRITE what fails that standard, not to comment on it.

${winningPlaybook}

Work through every deck against the seven-point scorecard. For each one:
- If slide 1 names a topic rather than a payoff, rewrite it as a specific-outcome hook using one of the ten hook categories. Put the real number in it where the deck contains one.
- If slide 2 is background, a contents list or an introduction, replace it with the proof the cover promised.
- If any slide is generic advice, rewrite it in the confession voice: what they used to do, why it broke, what they do now, what it produced.
- If a takeaway restates its title, rewrite it to explain WHY the rule is true.
- If the closing slide does not make one specific ask, rewrite it so it does.
- If the deck teaches a repeatable method that has no name, name it and use that name on the cover.

ABSOLUTE RULES:
- Never invent a number, company, client or outcome. You may only reuse figures already present in the deck. If a slide is weak and you have no real specific to strengthen it with, make it sharper and shorter rather than inventing evidence.
- Keep the same number of slides and the same slideTemplate on each.
- Preserve every field: slideNumber, title, body, takeaway, slideTemplate, sectionTag, designDirection.
- Keep the *asterisk* highlight marker on exactly one phrase per title.

Return ONLY a JSON array of the revised posts, in the same order and the same shape as the input. No commentary.`;

  const res = await genai.models.generateContent({
    model: "gemini-3.6-flash",
    config: { systemInstruction: system, temperature: 0.7, responseMimeType: "application/json" },
    contents: [{
      role: "user",
      parts: [{ text: `TOPIC: ${topic}

DECKS TO EDIT:
${JSON.stringify(posts)}` }],
    }],
  });

  const raw = (res.text || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const revised = JSON.parse(raw) as LinkedInPost[];

  // A pass that returns the wrong shape is a failed pass, not a new answer.
  if (!Array.isArray(revised) || revised.length !== posts.length) return posts;
  return revised.map((r, i) => (r?.carouselSlides?.length ? r : posts[i]));
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

  // Industry is no longer a field the user fills. An ablation showed it swapped
  // nouns without changing the argument, and the creator profile — injected
  // above as profileContext — already states the field they work in.
  if (params.targetAudience) {
    prompt += `**Target Audience:** ${params.targetAudience}\n`;
  }
  if (params.tonePrefs) {
    prompt += `**Tone & Style:** ${params.tonePrefs}\n`;
    // A bare tone label changed nothing: the same topic produced the same post
    // under Professional, Provocative and Storytelling, differing only in which
    // synonym it picked. A tone has to be described as MOVES — how it opens,
    // how it builds, what it refuses to do — before it changes anything.
    const directive = TONE_DIRECTIVES[params.tonePrefs];
    if (directive) prompt += `\n**What "${params.tonePrefs}" means here — follow it structurally, not just in word choice:**\n${directive}\n`;
  }

  // Industry and audience used to be bare labels, which the model largely
  // ignored — the same topic produced near-identical posts whoever it was aimed
  // at. Naming what each one must CHANGE is what makes them bite, the same way
  // assigning a hook archetype by name beats asking for "variety".
  if (params.targetAudience) {
    prompt += `\n**Write for that specific reader.** The audience and industry above are not decoration — they change the post:\n`;
    if (params.targetAudience) {
      prompt += `- **Vocabulary:** use the words this reader uses at work. Explain a term only if THIS reader would not already know it; explaining something they use daily reads as condescension.\n`;
      prompt += `- **Proof:** different readers accept different evidence. Executives want money, risk and time. Practitioners want the mechanism, the tool and the trade-off. Peers want the honest thing nobody says out loud. Pick the proof THIS reader finds convincing.\n`;
      prompt += `- **Objection:** name the specific push-back this reader would raise, and answer it inside the post. Ignoring the obvious objection reads as naive to the person who holds it.\n`;
      prompt += `- **Stakes:** frame the cost in terms this reader personally feels — their budget, their weekend, their credibility in a meeting.\n`;
      prompt += `- **CTA:** ask for something this reader could actually do next.\n`;
    }
    prompt += `\nIf the same post could be sent unchanged to a different audience, you have not used this brief.\n`;
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
  // Reference material and client direction go near the END of the brief, where
  // they are freshest — a rule stated 18k tokens earlier gets averaged away
  // against the knowledge base.
  if (params.referenceDocs?.length) {
    prompt += `

**USE THE REFERENCE MATERIAL ABOVE AS THE PRIMARY SOURCE.** The client attached ${params.referenceDocs.length} file(s) — read them fully and build the content from what they actually contain: the real figures, findings, names, structure and wording. Pull exact numbers from the file rather than approximating them, and never contradict it. Where the file and the creator profile disagree on a fact, the file wins — it is the newer, more specific source. If the file is thin, say less rather than inventing around it.`;
  }
  if (params.customInstructions?.trim()) {
    prompt += `

**CLIENT DIRECTION — these instructions override the defaults above wherever they conflict** (except the anti-fabrication rule, which is absolute):
"""
${params.customInstructions.trim()}
"""`;
  }

  prompt += `\n\n**Never invent numbers.** Do not write a statistic, percentage, currency figure, funding amount, study or benchmark unless it appears in the creator profile or the brief above. Real numbers are powerful; fabricated ones are a liability the creator has to defend in the comments and cannot. When you have no real figure, make the point qualitatively — "we rebuilt it twice before it held" beats an invented "28% lift".`;
  prompt += `\n\n**Hook discipline:** the opening line is a standalone sentence under 12 words. In the top-performing posts in your knowledge base, the best hooks average ~40 characters and the worst average ~77. Write short. One idea per line, blank line between beats.`;
  prompt += `\n\n**Important:** Generate exactly ${params.postsCount} unique post(s). Set "hookCategory" to the assigned archetype letter and name. Return a JSON array of post objects.`;

  if (params.postType === "carousel") {
    // 8-10 slides. Published 2026 benchmarks put the sweet spot at 8-12 with sharp
    // completion drop-off past 12; the original cap of 5 also fought the templates,
    // since a cardGrid holds four items and a numbered slide five.
    // The 8-10 default comes from completion benchmarks, but the user can ask
    // for anything from a 3-slide micro-deck to a 15-slide guide.
    const n = params.slidesCount && params.slidesCount >= 3 && params.slidesCount <= 15 ? params.slidesCount : 0;
    prompt += n
      ? `\n\nFor each carousel post, produce the carouselSlides array with EXACTLY ${n} slides — not ${n - 1}, not ${n + 1}. Slide 1 = the cover; slide ${n} = a clear call-to-action; the ${n - 2} slides between carry the substance. If the topic cannot fill ${n} slides with real material, go deeper on the mechanism rather than padding with restatement.`
      : `\n\nFor each carousel post, produce the carouselSlides array with 8 to 10 slides. Slide 1 = the cover; the final slide = a clear call-to-action; everything between carries the substance.`;

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


  if (params.postType === "article") {
    prompt += `\n\nFor each article, the body should contain the full article outline with section headers (use ## for headers) and key bullet points for each section.`;
  }

  return prompt;
}
