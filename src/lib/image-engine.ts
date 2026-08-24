import { generateImage as gathosGenerate, editImage as gathosEdit, isGathosConfigured } from "./gathos";
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
  engine: "tavily" | "gathos" | "gathos-i2i" | "gemini";
  model?: string;
  elapsedMs: number;
  /** Where a searched photo came from, so it can be credited or re-checked. */
  sourceUrl?: string;
  /** The seed the image was drawn with, so a render can be explained or repeated. */
  seed?: number;
}

/**
 * A fresh seed per render.
 *
 * Gathos treats -1 as "pick one", which is fine until two renders of the same
 * prompt come back identical. An explicit random integer is what guarantees the
 * picture moves even when the text does not.
 */
export function newSeed(): number {
  return 1 + Math.floor(Math.random() * 999999);
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
    /**
     * Seed handed to the image model. Defaults to a fresh random one, so a
     * re-render never repeats the previous picture by accident.
     */
    seed?: number;
    /**
     * A reference picture (base64) to merge with, plus how to merge it. This is
     * the multimodal path: the searched web image goes IN to Gathos rather than
     * being used as the background directly.
     */
    reference?: string;
    mergeInstruction?: string;
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
  const seed = opts.seed ?? newSeed();

  // Multimodal assembly: a reference picture was supplied (normally the web
  // image the search agent found), so it is fed INTO Gathos with the merge
  // instruction rather than used as the background as-is. Best-effort by
  // design — editImage returns null instead of throwing, and the chain below
  // carries on as if no reference had been given.
  if (opts.reference && isGathosConfigured()) {
    const merged = await gathosEdit(
      opts.reference,
      opts.mergeInstruction ? `${prompt}

${opts.mergeInstruction}` : prompt,
      { seed }
    );
    if (merged) {
      return {
        buffer: Buffer.from(merged.base64, "base64"),
        contentType: merged.contentType || "image/png",
        engine: "gathos-i2i",
        elapsedMs: Date.now() - start,
        seed,
      };
    }
    errors.push("gathos i2i: no result, falling back");
  }

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
      const img = await gathosGenerate(prompt, { width: opts.width, height: opts.height, seed });
      return {
        buffer: Buffer.from(img.base64, "base64"),
        contentType: img.contentType || "image/png",
        engine: "gathos",
        elapsedMs: Date.now() - start,
        seed: img.seedUsed ?? seed,
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
