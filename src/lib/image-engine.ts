import { generateImage as gathosGenerate, isGathosConfigured } from "./gathos";
import { findPhoto, isPhotoSearchConfigured } from "./tavily";
import { generateImage as geminiGenerate } from "./gemini-image";

/**
 * One entry point for photographic imagery, with three sources behind it.
 *
 * Tavily is tried FIRST, and only when the caller supplies a `photoQuery`. A
 * searched photograph beats a generated one for any slide whose subject is a
 * real scene, because a real photo cannot contain invented lettering — the
 * failure that made a generated stopwatch read "71:88" with START / LAP / RESET
 * burned into it. It is also two orders of magnitude faster: a search and
 * download is about a second against 49-126 for a Gathos render.
 *
 * Gathos is next: it is the tuned engine these 36 prompt styles were written
 * against, and it is what an abstract or stylised subject still needs. Gemini is
 * the last fallback, and the only source on an account with no Gathos key — so
 * image generation never becomes a dead button because one provider is missing
 * or out of quota.
 *
 * Callers pass LinkedIn-native pixel sizes. Each engine's constraints are
 * handled inside it: Gathos snaps to multiples of 16, Gemini takes an aspect
 * ratio instead of dimensions.
 */

export interface EngineImage {
  buffer: Buffer;
  contentType: string;
  engine: "tavily" | "gathos" | "gemini";
  model?: string;
  elapsedMs: number;
  /** Where a searched photo came from, so it can be credited or re-checked. */
  sourceUrl?: string;
}

function aspectFor(width: number, height: number): "1:1" | "4:5" | "16:9" {
  const r = width / height;
  if (r > 1.2) return "16:9";
  if (r < 0.95) return "4:5";
  return "1:1";
}

export async function generateBackground(
  prompt: string,
  opts: {
    width: number;
    height: number;
    geminiKey?: string;
    /**
     * A plain-language description of a real scene to search for. Supplying it
     * opts this call into photography; omitting it keeps the previous
     * generate-only behaviour exactly.
     */
    photoQuery?: string;
  }
): Promise<EngineImage> {
  const start = Date.now();
  const errors: string[] = [];

  if (opts.photoQuery && isPhotoSearchConfigured()) {
    // findPhoto walks its candidates and returns null rather than throwing, so
    // a dead image URL costs one fall-through instead of the whole image.
    const found = await findPhoto(opts.photoQuery);
    if (found) {
      return {
        buffer: found.buffer,
        contentType: found.contentType,
        engine: "tavily",
        elapsedMs: Date.now() - start,
        sourceUrl: found.photo.url,
      };
    }
    errors.push("photo search: no usable photo for that query");
  }

  if (isGathosConfigured()) {
    try {
      const img = await gathosGenerate(prompt, { width: opts.width, height: opts.height });
      return {
        buffer: Buffer.from(img.base64, "base64"),
        contentType: img.contentType || "image/png",
        engine: "gathos",
        elapsedMs: Date.now() - start,
      };
    } catch (err) {
      // Falling through to Gemini rather than failing: a quota error or a queue
      // timeout on one provider should not cost the user their image.
      errors.push(`gathos: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (opts.geminiKey) {
    try {
      const img = await geminiGenerate(opts.geminiKey, prompt, { aspectRatio: aspectFor(opts.width, opts.height) });
      return {
        buffer: img.buffer,
        contentType: img.mimeType,
        engine: "gemini",
        model: img.model,
        elapsedMs: Date.now() - start,
      };
    } catch (err) {
      errors.push(`gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    errors.push("gemini: no key on this account");
  }

  throw new Error(
    errors.length
      ? `Image generation failed. ${errors.join(" | ")}`
      : "No image source is available. Add a Gemini key in Settings, or set GATHOS_IMAGE_API_KEY or TAVILY_API_KEY."
  );
}
