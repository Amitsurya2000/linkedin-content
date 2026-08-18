/**
 * Tavily image search — real photography instead of generated art.
 *
 * Every image source in this app until now SYNTHESISED a picture, and that
 * carries a failure the prompt cannot fix: an image model asked for a stopwatch
 * draws one covered in invented digits. A run of this pipeline produced a
 * beautiful neon stopwatch reading "71:88" with a "288" underneath and START /
 * LAP / RESET buttons — none of which were asked for and none of which are real
 * words. Instructing "no lettering" does not help, because the SUBJECT is an
 * object made of numbers.
 *
 * A photograph has no such failure mode. So for slides whose subject is a real
 * scene — a person at a desk, a warehouse, a trading floor — a searched photo
 * beats a generated one outright, and costs a fraction of the time: Gathos took
 * 49-126 seconds per image; a search and download is under two.
 *
 * Configured exactly like gathos.ts: absent key means absent source, never a
 * dead button. `isTavilyConfigured()` is the guard every caller checks first.
 */

const BASE = process.env.TAVILY_BASE_URL || "https://api.tavily.com";
const KEY = process.env.TAVILY_API_KEY || "";

/** 12MB matches the resume uploader's ceiling — beyond it, something is wrong. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Tavily searches the whole web, so "images" includes things that must never
 * reach a published post. The first live run of this module returned, in order:
 * a Datadog product screenshot carrying another company's branding and a page of
 * real SQL, then an istockphoto preview, then a shutterstock preview. The stock
 * previews are watermarked and licensing them is the user's problem, not ours;
 * the screenshot is someone else's UI.
 *
 * So a photo is only accepted when its URL is on a freely-licensed host. Tried
 * first as Tavily's own include_domains: that filters the PAGES it searches, not
 * the images it extracts from them, so results still arrived from marketing
 * sites and one query starved to zero. Filtering the returned URLs instead is
 * both reliable and cheap.
 *
 * The consequence is deliberate: most queries will return nothing, and the
 * caller falls through to a generated image. A post that is safe to publish is
 * worth more than a photo of unknown provenance.
 */
const PHOTO_DOMAINS = [
  "unsplash.com",
  "images.unsplash.com",
  "pexels.com",
  "images.pexels.com",
  "pixabay.com",
  "cdn.pixabay.com",
  "burst.shopifycdn.com",
  "stocksnap.io",
];

/**
 * Belt and braces. include_domains is a request, not a guarantee — a CDN can
 * redirect, and a domain can be reached through a URL that does not name it —
 * so anything watermarked is rejected on the way out too.
 */
const BLOCKED = [
  "shutterstock", "istockphoto", "gettyimages", "alamy",
  "dreamstime", "123rf", "depositphotos", "adobestock", "stock.adobe",
];

function isPublishable(url: string): boolean {
  const u = url.toLowerCase();
  if (BLOCKED.some((b) => u.includes(b))) return false;
  return PHOTO_DOMAINS.some((d) => u.includes(d));
}

export function isTavilyConfigured(): boolean {
  return Boolean(KEY);
}

export interface TavilyPhoto {
  url: string;
  description?: string;
  /** The page the image was found on, kept so a source can be credited. */
  sourceUrl?: string;
}

interface TavilySearchResponse {
  images?: Array<string | { url?: string; description?: string }>;
  results?: Array<{ url?: string }>;
}

/**
 * Ask Tavily for photographs matching a query.
 *
 * `include_image_descriptions` is requested because the description is what
 * lets a caller reject an image that does not match the slide — Tavily ranks by
 * relevance to the words, which is not the same as being the right picture.
 */
export async function searchPhotos(query: string, limit = 5): Promise<TavilyPhoto[]> {
  if (!KEY) throw new Error("TAVILY_API_KEY is not configured");

  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      query,
      include_images: true,
      include_image_descriptions: true,
      search_depth: "basic",
      // Deliberately unrestricted: include_domains narrows the PAGES searched,
      // which starved queries without improving the images. The URL filter below
      // is what actually keeps the result publishable.
      max_results: Math.max(limit, 10),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Tavily search failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const data = (await res.json()) as TavilySearchResponse;
  const images = data.images ?? [];

  // The API returns bare URL strings when descriptions are off and objects when
  // they are on, so both shapes are handled rather than assumed.
  return images
    .map((img): TavilyPhoto | null => {
      if (typeof img === "string") return img ? { url: img } : null;
      return img?.url ? { url: img.url, description: img.description } : null;
    })
    .filter((p): p is TavilyPhoto => p !== null && isPublishable(p.url))
    .slice(0, limit);
}

/**
 * Fetch one image's bytes.
 *
 * Content-type is verified rather than trusted: an image URL that has rotted
 * into an HTML redirect or a 404 page would otherwise be written to disk and
 * fail later, inside sharp, with an error that says nothing about where it came
 * from.
 */
export async function downloadPhoto(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url, {
    // Some CDNs reject a request with no UA outright.
    headers: { "User-Agent": "Mozilla/5.0 (compatible; linkedin-content/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}) for ${url.slice(0, 80)}`);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Not an image (${contentType || "unknown type"}) at ${url.slice(0, 80)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error(`Image is ${(buffer.length / 1048576).toFixed(1)}MB, over the 12MB limit`);
  if (buffer.length < 1024) throw new Error("Image is under 1KB — almost certainly a placeholder");

  return { buffer, contentType };
}

/**
 * Search, then download the first candidate that actually resolves.
 *
 * Walking the list matters: image URLs in search results rot, hotlink-block, or
 * point at an HTML page. Returning null rather than throwing lets the caller
 * fall through to a generated image, which is the whole point of having more
 * than one source.
 */
export async function findPhoto(query: string): Promise<{ buffer: Buffer; contentType: string; photo: TavilyPhoto } | null> {
  let photos: TavilyPhoto[];
  try {
    photos = await searchPhotos(query);
  } catch {
    return null;
  }

  for (const photo of photos) {
    try {
      const { buffer, contentType } = await downloadPhoto(photo.url);
      return { buffer, contentType, photo };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}
