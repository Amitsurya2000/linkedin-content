/**
 * Renders the illustrated deck against sample copy, with no uploads and no art
 * generation, to prove the type-only fallback path composes correctly.
 *
 *   npx tsx scripts/visual-preview.ts
 */
import fs from "fs/promises";
import path from "path";
import { renderVisualDeck } from "../src/lib/deck-visual";
import { toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";

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

async function main() {
  const outDir = path.join(process.cwd(), "public", "visual-preview");
  await fs.mkdir(outDir, { recursive: true });
  for (const theme of ["paper", "slate", "ink"] as const) {
    const bufs = await renderVisualDeck(toKoyopoSlides(SAMPLE), {
      theme, author: "Alex Morgan", pageTotal: SAMPLE.length, generateArt: false,
    });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${theme}-${String(i + 1).padStart(2, "0")}.png`), bufs[i]);
    }
    console.log(`${theme}: ${bufs.length} slides`);
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
