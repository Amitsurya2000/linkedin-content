import { generateImage as gathosGenerate, isGathosConfigured } from "./gathos";
import { generateImage as geminiGenerate } from "./gemini-image";

/**
 * Unified background-image engine for posts and carousels.
 *
 * Two engines produce the text-free premium background the app then overlays
 * copy onto (via compose.ts). They are chosen automatically:
 *
 *   1. GATHOS — used when GATHOS_IMAGE_API_KEY is set. It is server-side (one
 *      key for the whole app), takes an EXACT pixel width/height so the style's
 *      canvas is honoured precisely, and is the engine this app was originally
 *      built around. This is the primary path.
 *   2. GEMINI — the fallback, using the caller's own per-user Gemini key. It
 *      takes an aspect ratio rather than pixels, so the style's width/height is
 *      mapped to the nearest supported ratio.
 *
 * Callers pass both the exact pixel size (for Gathos) and an optional Gemini
 * key (for the fallback); whichever engine is active consumes what it needs.
 */

export interface EngineImage {
  buffer: Buffer;
  mimeType: string;
  /** "gathos" or the Gemini model id that produced the image. */
  model: string;
  elapsedMs?: number;
  seedUsed?: number | null;
}

/** Gemini takes an aspect ratio, not pixels. Every style is square, portrait or landscape. */
function aspectFor(width: number, height: number): "1:1" | "4:5" | "16:9" {
  const r = width / height;
  if (r > 1.2) return "16:9";
  if (r < 0.95) return "4:5";
  return "1:1";
}

/** True when at least one engine can run given the (optional) per-user Gemini key. */
export function hasImageEngine(geminiKey?: string): boolean {
  return isGathosConfigured() || Boolean(geminiKey);
}

/**
 * Generate one text-free background at the requested pixel size.
 *
 * Throws only when NO engine is available, or when the selected engine fails —
 * the route surfaces the message to the client.
 */
export async function generateBackground(opts: {
  prompt: string;
  width: number;
  height: number;
  /** Per-user Gemini key, used only when Gathos is not configured. */
  geminiKey?: string;
  /** "pro" nudges the Gemini fallback toward its higher-quality model. */
  quality?: "fast" | "pro";
}): Promise<EngineImage> {
  const { prompt, width, height, geminiKey, quality } = opts;

  if (isGathosConfigured()) {
    const img = await gathosGenerate(prompt, { width, height });
    return {
      buffer: Buffer.from(img.base64, "base64"),
      mimeType: img.contentType,
      model: "gathos",
      elapsedMs: img.elapsedMs,
      seedUsed: img.seedUsed,
    };
  }

  if (geminiKey) {
    const img = await geminiGenerate(geminiKey, prompt, { aspectRatio: aspectFor(width, height), quality });
    return { buffer: img.buffer, mimeType: img.mimeType, model: img.model };
  }

  throw new Error(
    "No image engine is configured. Set GATHOS_IMAGE_API_KEY on the server, or add your Google Gemini key in Settings."
  );
}
