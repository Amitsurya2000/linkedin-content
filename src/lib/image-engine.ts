import { findPhoto, isPhotoSearchConfigured } from "./tavily";
import { generateImage as geminiGenerate, editImage as geminiEdit } from "./gemini-image";

/**
 * One entry point for imagery, with two sources behind it — both reached
 * through the one Gemini key.
 *
 * A real, searched photograph is tried first whenever the caller supplies a
 * `photoQuery` or a `reference` it already found: a search and download is
 * about a second, and a real photo cannot contain invented lettering — the
 * failure that made a generated stopwatch read "71:88" with START / LAP /
 * RESET burned into it. That photo is then handed to Gemini's image editor
 * along with the slide's own prompt, so the output still matches the deck's
 * art direction rather than looking like an unstyled stock photo pasted in.
 *
 * Plain Gemini text-to-image is the fallback: no photo was found, or the
 * caller asked for a fully synthesised subject to begin with.
 *
 * Callers pass LinkedIn-native pixel sizes; Gemini takes an aspect ratio
 * instead, computed here.
 */

export interface EngineImage {
  buffer: Buffer;
  contentType: string;
  engine: "tavily" | "gemini" | "gemini-edit";
  model?: string;
  elapsedMs: number;
  /** Where a searched photo came from, so it can be credited or re-checked. */
  sourceUrl?: string;
  /** The seed the image was drawn with, so a render can be explained or repeated. */
  seed?: number;
}

/**
 * A fresh seed per render, so a re-render never repeats the previous picture
 * by accident.
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
     * A reference picture (base64) the caller already searched for, plus how
     * to alter it. This is the multimodal path: the real photo goes IN to
     * Gemini's editor rather than being used as the background directly.
     */
    reference?: string;
    referenceContentType?: string;
    mergeInstruction?: string;
    width: number;
    height: number;
    geminiKey?: string;
    /**
     * A plain-language description of a real scene to search for. Supplying
     * it opts this call into photography: the engine searches, then feeds the
     * result into Gemini's editor with `prompt` as the alteration instruction.
     * Omitting it (with no `reference` either) keeps pure text-to-image.
     */
    photoQuery?: string;
  }
): Promise<EngineImage> {
  const start = Date.now();
  const errors: string[] = [];
  const seed = opts.seed ?? newSeed();

  // Get a real photo, either handed in already-found or searched for here.
  let photo: Buffer | null = null;
  let photoContentType = opts.referenceContentType || "image/jpeg";
  let sourceUrl: string | undefined;

  if (opts.reference) {
    photo = Buffer.from(opts.reference, "base64");
  } else if (opts.photoQuery && isPhotoSearchConfigured()) {
    // findPhoto walks its candidates and returns null rather than throwing, so
    // a dead image URL costs one fall-through instead of the whole image.
    const found = await findPhoto(opts.photoQuery);
    if (found) {
      photo = found.buffer;
      photoContentType = found.contentType;
      sourceUrl = found.photo.url;
    } else {
      errors.push("photo search: no usable photo for that query");
    }
  }

  if (photo) {
    if (opts.geminiKey) {
      try {
        const instruction = opts.mergeInstruction ? `${prompt}\n\n${opts.mergeInstruction}` : prompt;
        const img = await geminiEdit(opts.geminiKey, photo, instruction, photoContentType, {
          aspectRatio: aspectFor(opts.width, opts.height),
        });
        return {
          buffer: img.buffer,
          contentType: img.mimeType,
          engine: "gemini-edit",
          model: img.model,
          elapsedMs: Date.now() - start,
          seed,
          sourceUrl,
        };
      } catch (err) {
        // Falling back to the raw photo rather than failing: an edit-model
        // hiccup should not cost the user their image entirely.
        errors.push(`gemini edit: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return {
      buffer: photo,
      contentType: photoContentType,
      engine: "tavily",
      elapsedMs: Date.now() - start,
      sourceUrl,
    };
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
        seed,
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
      : "No image source is available. Add a Gemini key in Settings, or set TAVILY_API_KEY / PEXELS_API_KEY for real photos."
  );
}
