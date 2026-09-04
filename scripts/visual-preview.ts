/**
 * Renders the illustrated deck against sample copy, with no uploads and no art
 * generation, to prove the type-only fallback path composes correctly.
 *
 *   npx tsx scripts/visual-preview.ts
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { renderVisualDeck } from "../src/lib/deck-visual";
import { toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { userApiKeys } from "../src/lib/db/schema";
import { decrypt } from "../src/lib/crypto";

const SAMPLE: RawSlide[] = [
  { slideTemplate: "title", title: "Your month-end close does not need 5 days", body: "What changed when I stopped treating the calendar as fixed." },
  {
    slideTemplate: "cardGrid", title: "The close was never the bottleneck",
    takeaway: "Close time is not a constraint. It is an unexamined habit.",
    body: [
      "I inherited a 5-day month-end close and assumed that was how long it took.",
      "Nobody had ever timed the steps. We reconciled three currencies by hand, every month.",
      "I wrote the reconciliation into an Excel VBA macro over two weekends.",
    ].join("\n"),
  },
  { slideTemplate: "divider", title: "Follow for more", body: "Want the VBA template?" },
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
  const art = process.argv.includes("--art");
  const geminiKey = art ? await getGeminiKey() : undefined;

  const outDir = path.join(process.cwd(), "public", "visual-preview");
  await fs.mkdir(outDir, { recursive: true });
  const themes = art ? (["paper"] as const) : (["paper", "slate", "ink"] as const);
  for (const theme of themes) {
    const bufs = await renderVisualDeck(toKoyopoSlides(SAMPLE), {
      theme, author: "Alex Morgan", pageTotal: SAMPLE.length,
      generateArt: art, geminiKey, topic: "automating the month-end close",
      designDirections: [
        "Warm cinematic photograph, a finance professional at a desk at dusk",
        "Hand-drawn flat illustration of a calendar shrinking, muted palette",
        "Friendly cartoon character waving, simple flat vector style",
      ],
    });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${art ? "art-" : ""}${theme}-${String(i + 1).padStart(2, "0")}.png`), bufs[i]);
    }
    console.log(`${theme}: ${bufs.length} slides`);
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
