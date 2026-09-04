/**
 * Live check that Gemini image generation works with the stored key, so the
 * Gathos swap is proven rather than assumed.
 *
 *   npx tsx scripts/test-gemini-image.ts
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { userApiKeys } from "../src/lib/db/schema";
import { decrypt } from "../src/lib/crypto";
import { generateImage } from "../src/lib/gemini-image";

async function main() {
  const rows = await db
    .select({ encryptedKey: userApiKeys.encryptedKey, iv: userApiKeys.iv, authTag: userApiKeys.authTag })
    .from(userApiKeys)
    .where(eq(userApiKeys.provider, "gemini"))
    .limit(1);

  const row = rows[0];
  if (!row) { console.log("no gemini key stored"); return; }
  const apiKey = decrypt(row.encryptedKey, row.iv, row.authTag);

  const prompt =
    "Editorial photograph for a LinkedIn post about automating financial reporting. " +
    "A single analyst's desk at dusk, two monitors showing clean dashboards, warm side light, " +
    "shallow depth of field, muted navy and amber palette, no text, no logos, no watermarks. " +
    "Professional, restrained, premium business-editorial style.";

  const t0 = Date.now();
  const img = await generateImage(apiKey, prompt, { aspectRatio: "4:5" });
  const outDir = path.join(process.cwd(), "public", "assets-preview");
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "gemini-image-test.png");
  await fs.writeFile(out, img.buffer);

  console.log(`model: ${img.model}`);
  console.log(`mime:  ${img.mimeType}`);
  console.log(`bytes: ${(img.buffer.length / 1024).toFixed(0)} KB`);
  console.log(`time:  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`wrote: ${out}`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
