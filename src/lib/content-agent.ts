/**
 * Dynamic LinkedIn Content & Visual Automation Specialist.
 *
 * Drives TEXT and ARTICLE posts. The only instruction sent is
 * `prompts/linkedin-content-agent.md`, verbatim, with the resume placeholder
 * substituted — none of the gemini.ts prompt stack is used on this path.
 *
 * Carousels do NOT come through here: that schema has no slides array, so decks
 * stay on the code-driven builder in `carousel-prompt.ts`.
 *
 * The prompt returns copy AND a visual brief (a web image search query plus a
 * Gethos text-to-image prompt). The brief is stored on the post so that when
 * the user renders an image later it follows the direction the copy was written
 * with, instead of one of the 36 presets.
 */
import { generateWithRetry } from "./gemini";
import { renderTemperature } from "./carousel-prompt";
import fs from "fs";
import path from "path";

/** The prompt, read once at module load. A dev-server restart picks up edits. */
const AGENT_PROMPT = (() => {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "src/lib/prompts/linkedin-content-agent.md"),
      "utf-8"
    );
  } catch {
    return "";
  }
})();

/** The placeholder the resume block replaces. */
const RESUME_SLOT = "[INSERT RESUME TEXT / PARSED RESUME HERE]";

export interface VisualDirective {
  searchRequired: boolean;
  searchQuery: string;
  searchIntent: string;
  textToImagePrompt: string;
  multimodalInstruction: string;
  aspectRatio: string;
}

export interface ContentAgentPost {
  hookCategory: string;
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  whyThisWorks: string;
  variations: string[];
  carouselSlides: null;
  /** Stored as JSON on the post; read when an image is rendered. */
  visualDirective: VisualDirective;
}

export interface ContentAgentParams {
  apiKey: string;
  topic: string;
  postsCount: number;
  /** The resume-derived Creator Profile — the prompt's actual subject. */
  profileContext?: string;
  targetAudience?: string;
  tonePrefs?: string;
  customInstructions?: string;
  /**
   * Angles and hooks this user has already had. The prompt's CRITICAL RULE FOR
   * VARIATION forbids repeating a hook or core story; without a record of what
   * came before, it has nothing to compare against.
   */
  previousAngles?: { angle: string; hook: string }[];
  referenceDocs?: { data: string; mimeType: string; name?: string }[];
}

interface RawOut {
  content_type?: string;
  selected_resume_angle?: string;
  linkedin_post?: {
    hook?: string;
    body_text?: string;
    call_to_action?: string;
    hashtags?: unknown;
  };
  web_image_agent?: { search_required?: boolean; search_query?: string; search_intent?: string };
  gethos_prompt?: {
    text_to_image_prompt?: string;
    multimodal_instruction?: string;
    aspect_ratio?: string;
  };
}

const str = (v: unknown, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);

/**
 * The input block that replaces the prompt's resume placeholder.
 *
 * Everything here is DATA about the subject, not extra instruction: the resume,
 * what the client asked for, and the angles already used so the variation rule
 * has something concrete to avoid.
 */
function resumeBlock(params: ContentAgentParams, used: { angle: string; hook: string }[]): string {
  const lines: string[] = [];
  if (params.profileContext) lines.push(params.profileContext);
  else lines.push("(No resume on file — work from the topic below.)");
  lines.push("", `TOPIC FOR THIS EXECUTION: ${params.topic}`);
  if (params.targetAudience) lines.push(`TARGET AUDIENCE: ${params.targetAudience}`);
  if (params.tonePrefs) lines.push(`TONE: ${params.tonePrefs}`);
  if (params.customInstructions) lines.push(`CLIENT INSTRUCTIONS: ${params.customInstructions}`);
  if (used.length) {
    lines.push(
      "",
      "ALREADY USED (the variation rule forbids repeating these — pick a different angle and a different hook):"
    );
    for (const u of used) lines.push(`- angle: ${u.angle} | hook: "${u.hook}"`);
  }
  return lines.join("\n");
}

/**
 * Generate `postsCount` posts with the content agent prompt.
 *
 * One request per post, so each can be told what the previous ones already used
 * — the prompt picks its archetype per execution, and a single call asked for
 * three would draw the same one three times.
 */
export async function generateContentAgentPosts(
  params: ContentAgentParams
): Promise<ContentAgentPost[]> {
  if (!AGENT_PROMPT) {
    throw new Error(
      "linkedin-content-agent.md could not be read from src/lib/prompts/ — the content prompt is missing."
    );
  }

  const used: { angle: string; hook: string }[] = [...(params.previousAngles ?? [])];
  const posts: ContentAgentPost[] = [];

  for (let i = 0; i < params.postsCount; i++) {
    const filled = AGENT_PROMPT.includes(RESUME_SLOT)
      ? AGENT_PROMPT.replace(RESUME_SLOT, resumeBlock(params, used))
      : `${AGENT_PROMPT}\n\n--- INPUT RESUME ---\n${resumeBlock(params, used)}`;

    // Reference documents lead, so the model reads the source before the brief.
    const parts: Record<string, unknown>[] = [];
    for (const doc of params.referenceDocs ?? []) {
      parts.push({ inlineData: { mimeType: doc.mimeType, data: doc.data } });
      parts.push({
        text: `The file above is REFERENCE MATERIAL${doc.name ? ` ("${doc.name}")` : ""} supplied by the client. Treat it as part of the resume input.`,
      });
    }
    parts.push({ text: filled });

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
      throw new Error("The content agent returned something that is not JSON.");
    }
    if (Array.isArray(raw)) raw = (raw[0] ?? {}) as RawOut;

    const post = mapOut(raw);
    posts.push(post);
    used.push({ angle: post.whyThisWorks, hook: post.hook });
  }

  return posts;
}

/** Map one answer onto the record shape `generated_posts` already stores. */
function mapOut(raw: RawOut): ContentAgentPost {
  const lp = raw.linkedin_post ?? {};
  const wia = raw.web_image_agent ?? {};
  const gp = raw.gethos_prompt ?? {};

  const hook = str(lp.hook);
  const bodyText = str(lp.body_text);

  return {
    // content_type is the categorical field, so it fills the category column.
    hookCategory: str(raw.content_type, "Standard Post"),
    hook,
    body: bodyText,
    hashtags: Array.isArray(lp.hashtags)
      ? lp.hashtags.filter((h): h is string => typeof h === "string")
      : [],
    cta: str(lp.call_to_action),
    // The angle is what makes two posts on one topic different, so it is the
    // useful thing to show in the "why this works" slot.
    whyThisWorks: str(raw.selected_resume_angle),
    // The prompt returns one post per execution and no alternatives.
    variations: [],
    // Text and article posts have no slides.
    carouselSlides: null,
    visualDirective: {
      searchRequired: wia.search_required === true,
      searchQuery: str(wia.search_query),
      searchIntent: str(wia.search_intent),
      textToImagePrompt: str(gp.text_to_image_prompt),
      multimodalInstruction: str(gp.multimodal_instruction),
      // 4:5 is what the prompt specifies; anything else is passed through.
      aspectRatio: str(gp.aspect_ratio, "4:5"),
    },
  };
}
