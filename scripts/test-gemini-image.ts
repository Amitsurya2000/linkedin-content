/**
 * Live check that Gemini image generation works with the stored key, so the
 * Gathos swap is proven rather than assumed.
 *
 *   npx tsx scripts/test-gemini-image.ts
 */
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import { decrypt } from "../src/lib/crypto";
import { generateImage } from "../src/lib/gemini-image";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db
    .prepare("select encrypted_key, iv, auth_tag from user_api_keys where provider='gemini' limit 1")
    .get() as { encrypted_key: string; iv: string; auth_tag: string } | undefined;
  if (!row) { console.log("no gemini key stored"); return; }
  const apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);

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
