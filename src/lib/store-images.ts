/**
 * Store and serve generated images from the database.
 *
 * Vercel's serverless filesystem is read-only, so nothing can be written to
 * `public/` at runtime. Every rendered image is persisted here as base64 text
 * and served back through the `/api/post-images/[id]` proxy route. URLs stored
 * on posts are of the form `/api/post-images/{imageId}`.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { generatedImages } from "./db/schema";

/**
 * Generate a proxy URL for an image id, e.g. `/api/post-images/<id>`.
 * Leaves existing `/api/post-images/` URLs untouched.
 */
export function imageProxyUrl(id: string): string {
  return `/api/post-images/${id}`;
}

/**
 * Persist an array of image buffers and return their proxy URLs.
 *
 * Once stored, ownership is tied to the user so the proxy route can enforce
 * access control (a user may only fetch their own images).
 */
export async function storePostImages(
  userId: string,
  buffers: Buffer[],
  postId?: string,
  mimeType = "image/png"
): Promise<string[]> {
  const urls: string[] = [];
  for (const buf of buffers) {
    const [row] = await db
      .insert(generatedImages)
      .values({
        userId,
        postId,
        data: buf.toString("base64"),
        mimeType,
      })
      .returning({ id: generatedImages.id });
    urls.push(imageProxyUrl(row.id));
  }
  return urls;
}

/** Fetch a single image's buffer + mime type by id (no ownership check). */
export async function getImageBytes(
  imageId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const [row] = await db
    .select({ data: generatedImages.data, mimeType: generatedImages.mimeType })
    .from(generatedImages)
    .where(eq(generatedImages.id, imageId))
    .limit(1);
  if (!row) return null;
  return { buffer: Buffer.from(row.data, "base64"), mimeType: row.mimeType };
}

/**
 * Extract the image id from a stored URL. Returns null for URLs that are not
 * DB-backed (legacy `/generated/...` disk URLs).
 */
export function urlPrefixId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/^\/api\/post-images\/([^/?#]+)/);
  return m ? m[1] : null;
}

/**
 * Load the buffers for a list of stored image URLs.
 *
 * Accepts both `/api/post-images/<id>` and legacy `/generated/<file>` URLs. The
 * legacy prefix cannot be served anymore (no disk), so callers that still hold
 * old URLs get an empty array for those and are expected to re-render.
 */
export async function loadImageBuffers(urls: string[]): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (const url of urls) {
    const id = urlPrefixId(url);
    if (!id) continue;
    const img = await getImageBytes(id);
    if (img) out.push(img.buffer);
  }
  return out;
}

/**
 * Replace every stored URL that points at legacy disk paths. The frontend holds
 * posts with `carouselImages` / `imageUrl` that used to be `/generated/x.png`;
 * on serverless those can never resolve again. This normalises a single URL.
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url || url.startsWith("/api/post-images/") || url.startsWith("http")) return url ?? null;
  return null;
}
