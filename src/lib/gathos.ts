/**
 * Gathos image API client (server-side only).
 *
 * Text-to-image is the primary, production-solid engine — it returns a base64
 * PNG and renders long text pixel-perfectly (ideal for premium LinkedIn
 * visuals and quote cards). Image-to-image is best-effort: Gathos's i2i route
 * is currently flaky across their instances, so editImage() degrades
 * gracefully and never throws in a way that breaks the caller.
 *
 * Contract (verified live):
 *   POST  {BASE}/image-generation            -> { job_id, status: "queued" }
 *   GET   {BASE}/image-generation/jobs/{id}   -> { status, result: { image_base64, content_type, size_bytes, seed_used } }
 *   status reaches "completed" | "done" | "failed"
 */

const BASE = process.env.GATHOS_BASE_URL || "https://gathos.com/api/v1";
const IMAGE_KEY = process.env.GATHOS_IMAGE_API_KEY || "";
const I2I_KEY = process.env.GATHOS_I2I_API_KEY || "";

const SUBMIT_RETRIES = 6;
const POLL_TIMEOUT_MS = 210_000; // Gathos queue can be slow; be patient
const POLL_INTERVAL_MS = 3_000;

function headers(key: string, json = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "User-Agent": "Mozilla/5.0",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface GathosImage {
  base64: string; // raw base64 (no data: prefix)
  contentType: string; // e.g. "image/png"
  seedUsed?: number | null;
  sizeBytes?: number | null;
  elapsedMs: number;
}

/** Submit a job, tolerating 429s and transient network errors. */
async function submit(path: string, key: string, payload: unknown): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < SUBMIT_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(15000 + 10000 * attempt, 60000);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Gathos submit ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const jobId = data.job_id || data.jobId || data.id;
      if (!jobId) throw new Error(`Gathos submit returned no job_id: ${JSON.stringify(data).slice(0, 200)}`);
      return jobId;
    } catch (err) {
      lastErr = err;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error(`Gathos submit failed after ${SUBMIT_RETRIES} attempts: ${String(lastErr)}`);
}

interface PollResult {
  status: string;
  result: Record<string, unknown>;
}

async function poll(path: string, key: string): Promise<PollResult> {
  const start = Date.now();
  let transient = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: headers(key, false) });
      if (!res.ok) throw new Error(`poll ${res.status}`);
      const data = await res.json();
      transient = 0;
      const status = String(data.status || "").toLowerCase();
      if (status === "completed" || status === "done") {
        return { status, result: (data.result || {}) as Record<string, unknown> };
      }
      if (status === "failed") {
        throw new Error(`Gathos job failed: ${JSON.stringify(data.error || data).slice(0, 200)}`);
      }
    } catch (err) {
      // Distinguish a real "failed" from transient network blips.
      if (String(err).includes("Gathos job failed")) throw err;
      transient++;
      if (transient > 8) throw err;
      await sleep(Math.min(5000 * transient, 20000));
      continue;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Gathos job timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s`);
}

function stripDataUrl(b64: string): string {
  if (b64.startsWith("data:")) {
    const idx = b64.indexOf(",");
    if (idx !== -1) return b64.slice(idx + 1);
  }
  return b64;
}

/** Text-to-image — the primary premium image engine. */
export async function generateImage(
  prompt: string,
  opts: { width?: number; height?: number; steps?: number; guidanceScale?: number; usePromptEnhancer?: boolean; seed?: number } = {}
): Promise<GathosImage> {
  if (!IMAGE_KEY) throw new Error("GATHOS_IMAGE_API_KEY is not configured");
  const start = Date.now();
  const payload = {
    prompt: prompt.slice(0, 2000),
    width: opts.width ?? 1024,
    height: opts.height ?? 1024,
    guidance_scale: opts.guidanceScale ?? 1.0,
    steps: opts.steps ?? 8,
    use_prompt_enhancer: opts.usePromptEnhancer ?? true,
    seed: opts.seed ?? -1,
  };
  const jobId = await submit("/image-generation", IMAGE_KEY, payload);
  const { result } = await poll(`/image-generation/jobs/${jobId}`, IMAGE_KEY);
  const b64 = (result.image_base64 || result.image) as string | undefined;
  if (!b64) throw new Error("Gathos image job completed without image data");
  return {
    base64: stripDataUrl(b64),
    contentType: (result.content_type as string) || "image/png",
    seedUsed: (result.seed_used as number) ?? null,
    sizeBytes: (result.size_bytes as number) ?? null,
    elapsedMs: Date.now() - start,
  };
}

/**
 * Image-to-image (best-effort). Gathos's i2i endpoint is currently
 * unreliable, so this returns null on failure rather than throwing, letting
 * callers fall back to text-to-image.
 */
export async function editImage(
  sourceBase64OrDataUrl: string,
  prompt: string,
  opts: { strength?: number; steps?: number; guidanceScale?: number; seed?: number } = {}
): Promise<GathosImage | null> {
  if (!I2I_KEY) return null;
  const start = Date.now();
  const payload = {
    prompt: prompt.slice(0, 2000),
    image: sourceBase64OrDataUrl.startsWith("data:") ? sourceBase64OrDataUrl : `data:image/png;base64,${sourceBase64OrDataUrl}`,
    strength: opts.strength ?? 0.55,
    guidance_scale: opts.guidanceScale ?? 1.0,
    steps: opts.steps ?? 8,
    use_prompt_enhancer: true,
    seed: opts.seed ?? -1,
  };
  try {
    const jobId = await submit("/image-to-image", I2I_KEY, payload);
    const { result } = await poll(`/image-to-image/jobs/${jobId}`, I2I_KEY);
    const b64 = (result.image_base64 || result.image) as string | undefined;
    const url = result.image_url as string | undefined;
    if (b64) {
      return {
        base64: stripDataUrl(b64),
        contentType: (result.content_type as string) || "image/png",
        elapsedMs: Date.now() - start,
      };
    }
    if (url) {
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      return { base64: buf.toString("base64"), contentType: "image/png", elapsedMs: Date.now() - start };
    }
    return null;
  } catch {
    return null; // graceful — caller falls back to text-to-image
  }
}

export function isGathosConfigured(): boolean {
  return Boolean(IMAGE_KEY);
}
