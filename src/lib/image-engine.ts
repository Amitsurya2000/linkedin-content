import { generateImage as gathosGenerate, isGathosConfigured } from "./gathos";
import { generateImage as geminiGenerate } from "./gemini-image";

/**
 * One entry point for photographic image generation, with two engines behind it.
 *
 * Gathos is primary when a key is present: it is the tuned engine these 36
 * prompt styles were written against. Gemini is the fallback, and the only
 * engine on an account with no Gathos key — so image generation never becomes
 * a dead button just because a server-side key is missing or its quota ran out.
 *
 * Callers pass LinkedIn-native pixel sizes. Each engine's constraints are
 * handled inside it: Gathos snaps to multiples of 16, Gemini takes an aspect
 * ratio instead of dimensions.
 */

export interface EngineImage {
  buffer: Buffer;
  contentType: string;
  engine: "gathos" | "gemini";
  model?: string;
  elapsedMs: number;
}

function aspectFor(width: number, height: number): "1:1" | "4:5" | "16:9" {
  const r = width / height;
  if (r > 1.2) return "16:9";
  if (r < 0.95) return "4:5";
  return "1:1";
}

export async function generateBackground(
  prompt: string,
  opts: { width: number; height: number; geminiKey?: string }
): Promise<EngineImage> {
  const start = Date.now();
  const errors: string[] = [];

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
      : "No image engine is available. Add a Gemini key in Settings, or set GATHOS_IMAGE_API_KEY."
  );
}
