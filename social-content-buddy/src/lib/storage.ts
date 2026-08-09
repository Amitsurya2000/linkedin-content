import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

/** Downloads an image from a URL and uploads it to Cloudflare R2. Returns the public URL. */
export async function uploadImageFromUrl(
  sourceUrl: string,
  key: string
): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from fal.ai: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${PUBLIC_URL}/${key}`;
}

export function postImageKey(batchId: string, postId: string): string {
  return `posts/${batchId}/${postId}.png`;
}

// ─── Asset uploads (logos, product photos) ───────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(contentType: string, size: number): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return "Only PNG, JPG, and WebP images are allowed";
  }
  if (size > MAX_FILE_SIZE) {
    return "Image must be under 5MB";
  }
  return null;
}

function extFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function logoAssetKey(userId: string, contentType: string): string {
  return `assets/${userId}/logo.${extFromContentType(contentType)}`;
}

export function productAssetKey(userId: string): string {
  return `assets/${userId}/products/${crypto.randomUUID()}.png`;
}

/** Upload raw image bytes to R2. Returns the public URL. */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

/** Delete an object from R2 by its full public URL or key. */
export async function deleteAsset(urlOrKey: string): Promise<void> {
  const key = urlOrKey.startsWith("http")
    ? urlOrKey.replace(`${PUBLIC_URL}/`, "")
    : urlOrKey;
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
