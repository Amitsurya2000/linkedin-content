/**
 * Renders slide 2 of a sample deck in every spec-driven style, so the shelf can
 * be compared side by side.
 *
 *   npx tsx scripts/lab-preview.ts
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { renderLabDeck } from "../src/lib/deck-lab";
import { LAB_STYLES, type LabStyleName } from "../src/lib/deck-lab-styles";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { userApiKeys } from "../src/lib/db/schema";
import { decrypt } from "../src/lib/crypto";
import { toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";

const SAMPLE: RawSlide[] = [
  { slideTemplate: "title", title: "Cut your month-end close to 36 hours", body: "The exact VBA setup that replaced five days of manual reconciliation." },
  {
    slideTemplate: "cardGrid", title: "Open the reconciliation sheet",
    takeaway: "Start where the hours actually go, not where the noise is.",
    body: "Open the workbook you rebuild every month.\nFind the tab you copy into by hand.\nThat tab is the whole problem.",
  },
  {
    slideTemplate: "bigStat", title: "The close time reduction",
    body: "36 hrs\ndown from 120 hours, with 22% better accuracy",
    takeaway: "Eliminating manual entry improves accuracy, not just speed.",
  },
  {
    slideTemplate: "twoColumn", title: "Manual close vs automated",
    takeaway: "Automating data movement frees analysts for judgement work.",
    body: [
      "Manual",
      "- 5 full days processing",
      "- 22% error risk in recs",
      "Automated",
      "- 36-hour total cycle",
      "- Errors caught at source",
    ].join("\n"),
  },
  {
    slideTemplate: "cardGrid", title: "The close was never the bottleneck",
    takeaway: "Close time is not a constraint. It is an unexamined habit.",
    body: [
      "I inherited a 5-day month-end close and assumed that was how long it took.",
      "Nobody had ever timed the steps. We reconciled three currencies by hand.",
      "I wrote the reconciliation into a macro over two weekends. It now takes 36 hours.",
    ].join("\n"),
  },
];

async function getGeminiKey(): Promise<string | undefined> {
  const rows = await db
    .select({ encryptedKey: userApiKeys.encryptedKey, iv: userApiKeys.iv, authTag: userApiKeys.authTag })
    .from(userApiKeys)
    .where(eq(userApiKeys.provider, "gemini"))
    .limit(1);
  const row = rows[0];
  if (row) return decrypt(row.encryptedKey, row.iv, row.authTag);
  return undefined;
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "lab-preview");
  await fs.mkdir(outDir, { recursive: true });
  const art = process.argv.includes("--art");
  const geminiKey = art ? await getGeminiKey() : undefined;
  const only = process.argv.find((a) => a.startsWith("--style="))?.split("=")[1] as LabStyleName | undefined;
  const styles = only ? [only] : (Object.keys(LAB_STYLES) as LabStyleName[]);

  for (const style of styles) {
    const bufs = await renderLabDeck(toKoyopoSlides(SAMPLE), {
      style, author: "Alex Morgan",
      referenceImages: (process.argv.find((a) => a.startsWith("--shots="))?.split("=")[1] ?? "").split(",").filter(Boolean),
      generateArt: art, geminiKey, topic: "automating the month-end close",
      designDirections: [
        "Cinematic photograph of a finance professional at a desk at dusk",
        "Flat illustration of a shrinking calendar, muted palette",
      ],
    });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${art ? "art-" : ""}${style}-${i + 1}.png`), bufs[i]);
    }
    console.log(`${style.padEnd(12)} ${LAB_STYLES[style].blurb}`);
  }
  console.log(`\nwrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
