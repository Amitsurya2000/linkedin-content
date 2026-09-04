/**
 * Shared Gemini wrapper with automatic retry and fallback models.
 *
 * When the primary model returns 503 (overloaded) or 429 (rate-limited),
 * the call is retried with exponential backoff. If all retries are exhausted
 * on the primary model, a lighter fallback model is tried.
 *
 * Every file that calls `genai.models.generateContent` should go through
 * this helper so retry logic lives in one place.
 */
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

const PRIMARY_MODEL = "gemini-3.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

/** Status codes that are worth retrying. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: unknown): boolean {
  const status =
    (err as { status?: number }).status ??
    (err as { status?: string })?.status ??
    0;
  if (RETRYABLE.has(Number(status))) return true;

  const msg = String((err as { message?: string }).message ?? "");
  return (
    msg.includes("UNAVAILABLE") ||
    msg.includes("overloaded") ||
    msg.includes("rate limit") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("503")
  );
}

export interface GenerateOptions {
  apiKey: string;
  model?: string;
  config?: Record<string, unknown>;
  contents: Array<{ role: string; parts: Record<string, unknown>[] }>;
}

/**
 * Call Gemini with retry + fallback. Returns the raw response.
 *
 * Tries the primary model up to `MAX_RETRIES` times with exponential
 * backoff. If every attempt fails, falls back to lighter models in order.
 */
export async function generateWithRetry(
  opts: GenerateOptions
): Promise<GenerateContentResponse> {
  const genai = new GoogleGenAI({ apiKey: opts.apiKey });
  const models = [opts.model ?? PRIMARY_MODEL, ...FALLBACK_MODELS];

  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await genai.models.generateContent({
          model,
          config: opts.config,
          contents: opts.contents,
        });
        return res;
      } catch (err) {
        const isLastModel = model === models[models.length - 1];
        const isLastAttempt = attempt === MAX_RETRIES;

        if (!isRetryable(err) || isLastAttempt) {
          if (isLastModel) throw err;
          break; // move to next fallback model
        }

        const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
        console.warn(
          `[gemini] ${model} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms…`
        );
        await sleep(delay);
      }
    }
  }

  throw new Error("All Gemini models and retries exhausted.");
}
