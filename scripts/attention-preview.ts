/**
 * Renders the "attention" style against a sample deck that exercises every
 * template it adds: highlight-chip cover, paragraph card, Q&A, bar chart,
 * big stat, two-column and the outro CTA slide.
 *
 *   npx tsx scripts/attention-preview.ts
 *   npx tsx scripts/attention-preview.ts --theme=paper --photo=./assets/headshot.png
 */
import fs from "fs/promises";
import path from "path";
import { renderAttnDeck, ATTN_THEMES, type AttnThemeName } from "../src/lib/deck-attention";
import { toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";

const SAMPLE: RawSlide[] = [
  {
    slideTemplate: "title",
    title: "Your month-end close does not need *5 days*",
    body: "What changed when I stopped treating the calendar as fixed.",
  },
  {
    slideTemplate: "cardGrid",
    title: "The close was never the *bottleneck*",
    takeaway: "Close time is not a constraint. It is an unexamined habit.",
    body: [
      "I inherited a 5-day month-end close and assumed that was just how long it took.",
      "But nobody had ever timed the steps. We were reconciling three currencies by hand, every month.",
      "I wrote the reconciliation into an Excel VBA macro over two weekends.",
      "The close now finishes in 36 hours, and the numbers are 22% more accurate.",
    ].join("\n"),
  },
  {
    slideTemplate: "numbered",
    title: "Where the *time* actually went",
    takeaway: "Automate the step that eats the most hours, not the one that annoys you most.",
    body: [
      "Multi-currency reconciliation — 41",
      "Intercompany matching — 22",
      "Variance write-ups — 18",
      "Review and sign-off — 9",
    ].join("\n"),
  },
  {
    slideTemplate: "worksheet",
    title: "What finance teams *ask me*",
    takeaway: "You do not need a data team. You need one afternoon and one repeated task.",
    body: [
      "Do I need Python for this? No. The reconciliation that saved us 3.5 days is pure Excel VBA.",
      "What if my data is messy? Then automate the cleaning first — it is the step you repeat most.",
      "How do I get buy-in? Time one cycle by hand and show the hours back. Nobody argues with a stopwatch.",
    ].join("\n"),
  },
  {
    slideTemplate: "bigStat",
    title: "The number that ended the *debate*",
    body: "36 hrs\ndown from 5 days, with 22% better accuracy",
    takeaway: "Bring a number to the meeting and the meeting gets short.",
  },
  {
    slideTemplate: "divider",
    title: "Follow for more",
    body: "Want the VBA reconciliation template I used?",
  },
];

async function main() {
  const args = process.argv.slice(2);
  const themeArg = args.find((a) => a.startsWith("--theme="))?.split("=")[1] as AttnThemeName | undefined;
  const photo = args.find((a) => a.startsWith("--photo="))?.split("=")[1];

  const slides = toKoyopoSlides(SAMPLE);
  const themes = themeArg ? [themeArg] : (Object.keys(ATTN_THEMES) as AttnThemeName[]);
  const outDir = path.join(process.cwd(), "public", "attention-preview");
  await fs.mkdir(outDir, { recursive: true });

  for (const theme of themes) {
    const bufs = await renderAttnDeck(slides, {
      canvas: "tall",
      theme,
      author: "Alex Morgan",
      photoPath: photo,
      cta: { line: "Repost and Follow *Alex Morgan* for more content like this", button: "Send me the VBA template" },
    });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${theme}-${String(i + 1).padStart(2, "0")}.png`), bufs[i]);
    }
    console.log(`${theme}: ${bufs.length} slides`);
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
