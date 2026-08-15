/**
 * Live check that the configured Gathos key generates an image, so the wiring
 * is proven against the real service rather than assumed.
 *
 *   npx tsx --env-file=.env.local scripts/test-gathos.ts
 */
import fs from "fs/promises";
import path from "path";
import { generateImage, isGathosConfigured } from "../src/lib/gathos";

async function main() {
  if (!isGathosConfigured()) {
    console.log("GATHOS_IMAGE_API_KEY is not set");
    return;
  }

  const prompt =
    "Editorial photograph for a LinkedIn post about automating financial reporting. " +
    "An analyst's desk at dusk, two monitors showing clean dashboards, warm side light, " +
    "shallow depth of field, muted navy and amber palette, no text, no logos. " +
    "Professional, restrained, premium business-editorial style.";

  const t0 = Date.now();
  const img = await generateImage(prompt, { width: 1080, height: 1350 });
  const outDir = path.join(process.cwd(), "public", "assets-preview");
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "gathos-test.png");
  await fs.writeFile(out, Buffer.from(img.base64, "base64"));

  console.log(`type:  ${img.contentType}`);
  console.log(`bytes: ${(Buffer.from(img.base64, "base64").length / 1024).toFixed(0)} KB`);
  console.log(`seed:  ${img.seedUsed ?? "n/a"}`);
  console.log(`time:  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`wrote: ${out}`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
