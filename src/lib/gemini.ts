import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// Load the LinkedIn system prompt from the markdown file
const systemPrompt = fs.readFileSync(
  path.join(process.cwd(), "src/lib/prompts/linkedin-system-prompt.md"),
  "utf-8"
);

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
  carouselSlides?: { slideNumber: number; title: string; body: string; designDirection: string }[] | null;
}

export async function generateLinkedInPosts(params: GenerateLinkedInPostsParams): Promise<LinkedInPost[]> {
  const genai = new GoogleGenAI({ apiKey: params.apiKey });

  const userMessage = buildUserPrompt(params);

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
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
  prompt += `\n**Important:** Generate exactly ${params.postsCount} unique post(s). Each must use a DIFFERENT hook category. Return a JSON array of post objects.`;

  if (params.postType === "carousel") {
    prompt += `\n\nFor each carousel post, produce the carouselSlides array with a MAXIMUM of 5 slides (never more than 5). Structure: slide 1 = the cover (a punchy hook title, very little or no body); middle slides = ONE idea each; the final slide = a clear call-to-action. CRITICAL: every slide must fit on a graphic — keep each slide's "title" under 8 words and each "body" under 25 words (1-2 short sentences), written as COMPLETE sentences (never trailing off). The text will be printed verbatim onto the image, so it must be self-contained and finished.`;
  }

  if (params.postType === "poll") {
    prompt += `\n\nFor each poll post, include the poll question in the hook, poll options in the body (formatted as numbered list), and context/follow-up in the cta field.`;
  }

  if (params.postType === "article") {
    prompt += `\n\nFor each article, the body should contain the full article outline with section headers (use ## for headers) and key bullet points for each section.`;
  }

  return prompt;
}
