import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { join } from "path";
import { isUnsafeUrl } from "@/lib/validation";

// Load system prompt lazily
let _systemPrompt: string | null = null;
function getSystemPrompt(): string {
  if (_systemPrompt) return _systemPrompt;
  const candidates = [
    join(process.cwd(), "src/lib/prompts/social-post-generator-system-prompt.md"),
    join(process.cwd(), "../bau/social-post-generator-system-prompt.md"),
    join(process.cwd(), "../../bau/social-post-generator-system-prompt.md"),
  ];
  for (const p of candidates) {
    try {
      _systemPrompt = readFileSync(p, "utf-8");
      return _systemPrompt;
    } catch {
      // try next
    }
  }
  throw new Error("Could not find social-post-generator-system-prompt.md");
}

export interface DesignBrief {
  hookCategory: string;
  captionHook: string;
  captionBody: string;
  hashtags: string[];
  designBrief: string;
  whyThisWorks: string;
  captionVariations?: string[];
}

export interface GenerateBriefsInput {
  businessName: string;
  websiteUrl?: string;
  targetAudience?: string;
  tonePrefs?: string;
  postsCount: number;
  brandColors?: string[];
  brandFonts?: Record<string, string>;
  brandGuidelines?: string;
  logoUrl?: string;
  productImageUrl?: string;
}

/** Fetch an image URL and return base64 + MIME type */
async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = res.headers.get("content-type") || "image/png";
  return { base64, mimeType: contentType };
}

export async function generateDesignBriefs(
  input: GenerateBriefsInput,
  apiKey: string
): Promise<DesignBrief[]> {
  const genai = new GoogleGenAI({ apiKey });
  const systemPrompt = getSystemPrompt();

  // SSRF protection: block internal/private URLs
  const safeWebsiteUrl = input.websiteUrl && !isUnsafeUrl(input.websiteUrl) ? input.websiteUrl : undefined;

  // Build brand context section
  let brandContext = "";
  if (input.brandColors?.length) {
    brandContext += `\nBrand Colors: ${input.brandColors.join(", ")}`;
  }
  if (input.brandFonts) {
    const parts = Object.entries(input.brandFonts)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    if (parts.length) brandContext += `\nBrand Fonts: ${parts.join(", ")}`;
  }
  if (input.brandGuidelines) {
    brandContext += `\nBrand Guidelines: ${input.brandGuidelines}`;
  }

  // Build conditional image instruction sections
  let imageInstructions = "";
  if (input.logoUrl) {
    imageInstructions += `

LOGO INTEGRATION:
I have attached the business logo image. Analyze it carefully — note its colors, shapes, typography, and visual style. In EVERY design brief, subtly integrate this logo:
- Describe the logo's exact visual appearance (shape, colors, text if any) so the image generator can recreate it
- Place it naturally in the composition — typically bottom-right or bottom-center at 60-80px
- The logo should feel native to the design, not pasted on — match its style to the post's visual language
- Reference the logo's actual colors when describing its placement`;
  }

  if (input.productImageUrl) {
    imageInstructions += `

PRODUCT INTEGRATION:
I have attached a product photo. Analyze the product's appearance — its shape, color, texture, packaging, and context. Build each post's visual concept around showcasing this product:
- Describe how the product appears in the frame (centered on a clean surface, lifestyle context, in-use scenario, or hero shot)
- The product should be the visual anchor of the post — the first thing the eye lands on
- Describe the product's physical details accurately so the image generator can represent it faithfully
- Use complementary backgrounds and styling that make the product stand out
- Do NOT describe it as "the attached photo" — describe the actual product as if giving instructions to a designer who hasn't seen it`;
  }

  const userMessage = `
Business Name: ${input.businessName}
${safeWebsiteUrl ? `Website URL: ${safeWebsiteUrl}` : ""}
${input.targetAudience ? `Target Audience: ${input.targetAudience}` : ""}
${input.tonePrefs ? `Tone/Personality Preferences: ${input.tonePrefs}` : ""}${brandContext}
Number of posts to generate: ${input.postsCount}
${imageInstructions}
Generate exactly ${input.postsCount} posts following the system instructions.

IMPORTANT: Return your response as a valid JSON array only, with no other text before or after. Each element must have these exact keys:
- hookCategory: The hook type used (e.g. "The Comparison")
- captionHook: The opening caption line (max 12 words, attention-grabbing hook)
- captionBody: A full Instagram caption body (2-4 engaging sentences that expand on the hook, include a clear call-to-action at the end)
- hashtags: An array of 10-15 relevant hashtags as strings (include "#" prefix, mix of broad and niche tags)
- designBrief: The full design brief as a single flowing paragraph with all specs${brandContext ? " — MUST incorporate the brand colors and fonts specified above" : ""}${input.logoUrl ? " — MUST describe and place the brand logo as specified above" : ""}${input.productImageUrl ? " — MUST feature the product as the visual hero as specified above" : ""}
- whyThisWorks: 1-2 sentences on the psychological mechanism
- captionVariations: An array of exactly 3 alternative full captions (each is a complete caption with hook + body, different angles/tones)
`;

  // Build content parts: text + optional inline images
  const parts: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [];

  // Fetch and attach logo image if provided
  if (input.logoUrl) {
    try {
      const { base64, mimeType } = await fetchImageAsBase64(input.logoUrl);
      parts.push({ inlineData: { data: base64, mimeType } });
    } catch (err) {
      console.error("Failed to fetch logo for Gemini:", err);
      // Continue without logo — don't fail the entire generation
    }
  }

  // Fetch and attach product image if provided
  if (input.productImageUrl) {
    try {
      const { base64, mimeType } = await fetchImageAsBase64(input.productImageUrl);
      parts.push({ inlineData: { data: base64, mimeType } });
    } catch (err) {
      console.error("Failed to fetch product image for Gemini:", err);
    }
  }

  // Text prompt always comes last so Gemini sees images first
  parts.push({ text: userMessage });

  const response = await genai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.8,
      responseMimeType: "application/json",
      tools: safeWebsiteUrl ? [{ urlContext: {} }] : [],
    },
    contents: [{ role: "user", parts }],
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  let briefs: DesignBrief[];
  try {
    briefs = JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse Gemini response as JSON");
    briefs = JSON.parse(match[0]);
  }

  if (!Array.isArray(briefs) || briefs.length === 0) {
    throw new Error("Gemini returned invalid briefs format");
  }

  return briefs.slice(0, input.postsCount);
}
