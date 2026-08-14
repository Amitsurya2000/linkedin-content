import { GoogleGenAI } from "@google/genai";

/**
 * Gemini image generation.
 *
 * Replaces the Gathos client: the app now runs on ONE key. Gemini's image
 * models are reached through the same `generateContent` call as text, with
 * IMAGE in the response modalities, and return the bytes inline as base64.
 *
 * Model choice is a fallback chain rather than a constant because the image
 * line moves fast and a hard-coded preview id turns into a 404 the day it is
 * promoted. Verified available on this account:
 *   gemini-3.1-flash-image, gemini-3-pro-image, gemini-2.5-flash-image
 */

/** Tried in order; the first that returns bytes wins. */
export const IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
] as const;

/** Higher quality, slower — used when the caller asks for the hero image. */
export const IMAGE_MODELS_PRO = [
  "gemini-3-pro-image",
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
] as const;

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  model: string;
}

export interface ImageOptions {
  /** LinkedIn-relevant ratios: "1:1", "4:5" (feed-native), "16:9". */
  aspectRatio?: "1:1" | "4:5" | "3:4" | "16:9" | "9:16";
  quality?: "fast" | "pro";
  /** Reference image for edits, as raw bytes. */
  editImage?: { data: Buffer; mimeType: string };
}

function extractImage(res: unknown): { data: string; mimeType: string } | null {
  const candidates = (res as { candidates?: { content?: { parts?: unknown[] } }[] })?.candidates ?? [];
  for (const c of candidates) {
    for (const part of c.content?.parts ?? []) {
      const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) return { data: inline.data, mimeType: inline.mimeType ?? "image/png" };
    }
  }
  return null;
}

/**
 * Generate one image. Throws only when every model in the chain fails, so a
 * single deprecated id cannot take the feature down.
 */
export async function generateImage(
  apiKey: string,
  prompt: string,
  opts: ImageOptions = {}
): Promise<GeneratedImage> {
  const genai = new GoogleGenAI({ apiKey });
  const chain = opts.quality === "pro" ? IMAGE_MODELS_PRO : IMAGE_MODELS;
  const errors: string[] = [];

  const parts: Record<string, unknown>[] = [];
  if (opts.editImage) {
    parts.push({ inlineData: { mimeType: opts.editImage.mimeType, data: opts.editImage.data.toString("base64") } });
  }
  parts.push({ text: prompt });

  for (const model of chain) {
    try {
      const res = await genai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          ...(opts.aspectRatio ? { imageConfig: { aspectRatio: opts.aspectRatio } } : {}),
        },
      });
      const img = extractImage(res);
      if (img) {
        return { buffer: Buffer.from(img.data, "base64"), mimeType: img.mimeType, model };
      }
      // A response with no image part usually means the prompt tripped a safety
      // filter; the next model will almost certainly do the same, but trying is
      // cheap and the error text differs usefully between them.
      errors.push(`${model}: no image in response`);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(`Image generation failed. ${errors.join(" | ")}`);
}

/** Edit an existing image with an instruction — same key, same chain. */
export async function editImage(
  apiKey: string,
  image: Buffer,
  instruction: string,
  mimeType = "image/png",
  opts: Omit<ImageOptions, "editImage"> = {}
): Promise<GeneratedImage> {
  return generateImage(apiKey, instruction, { ...opts, editImage: { data: image, mimeType } });
}
