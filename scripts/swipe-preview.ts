/**
 * Renders the newest carousel in the minimalist "swipe" style, or a built-in
 * sample deck when the DB has none, so the layout can be checked without
 * generating a post first.
 *
 *   npx tsx scripts/swipe-preview.ts            # newest carousel from the DB
 *   npx tsx scripts/swipe-preview.ts --sample   # built-in sample copy
 *   npx tsx scripts/swipe-preview.ts --theme=slate
 */
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import { renderSwipeDeck, toKoyopoSlides, SWIPE_THEMES, type RawSlide, type SwipeThemeName } from "../src/lib/deck-swipe";

const SAMPLE: RawSlide[] = [
  { slideTemplate: "title", title: "10 Rules to 10x Your Output", body: "The habits that separate people who ship from people who stay busy." },
  {
    slideTemplate: "cardGrid", title: "Take A Break Every 2-3 Hours",
    subtitle: "Working longer is not the same as getting more done. Step away before your focus disappears.",
    body: [
      "I used to treat breaks like a reward for finishing the work.",
      "But when the work never really ends, that usually means no break at all.",
      "Now even if I step away every couple of hours, it's just 10 minutes to walk or grab food. Nothing with a screen.",
      "I come back with more focus and usually finish the next task faster.",
    ].join("\n"),
  },
  {
    slideTemplate: "cardGrid", title: "Cut 2 Tasks Before Adding 1",
    subtitle: "Most to-do lists fail from addition. Make every new task earn its place.",
    body: [
      "I used to add a new goal every time something got me excited.",
      "But my list kept growing and nothing ever felt finished.",
      "Now I have a rule. If something new makes it onto my list, 2 existing tasks have to come off.",
      "It forces me to think about what I ACTUALLY need to achieve that week to get the results I want.",
    ].join("\n"),
  },
  {
    slideTemplate: "bigStat", title: "The Cost Of Context Switching",
    // bigStat reads its figure from the first body line and its label from the second.
    body: "23 min\nto refocus after one interruption",
    subtitle: "Protecting a 90-minute block beats finding four 20-minute ones.",
  },
  {
    slideTemplate: "twoColumn", title: "Busy vs Productive",
    subtitle: "Busy is a volume metric. Productive is an outcome metric.",
    body: [
      "Busy",
      "- Answers every message within minutes",
      "- Keeps a 30-item list",
      "- Measures hours worked",
      "Productive",
      "- Batches messages twice a day",
      "- Keeps a 3-item list",
      "- Measures outcomes shipped",
    ].join("\n"),
  },
  { slideTemplate: "divider", title: "Pick one rule. Run it for a week.", body: "Then add the next. Ten at once is how none of them stick." },
];

async function main() {
  const args = process.argv.slice(2);
  const themeArg = args.find((a) => a.startsWith("--theme="))?.split("=")[1] as SwipeThemeName | undefined;
  const useSample = args.includes("--sample");

  let raw: RawSlide[] = SAMPLE;
  let seed = "sample";
  if (!useSample) {
    try {
      const db = new Database("./linkedin-posts.db");
      const row = db.prepare(
        `select gp.id, gp.carousel_slides from generated_posts gp
         join post_batches pb on pb.id = gp.batch_id
         where pb.post_type = 'carousel' and gp.carousel_slides is not null
         order by pb.created_at desc limit 1`
      ).get() as { id: string; carousel_slides: string } | undefined;
      if (row) { raw = JSON.parse(row.carousel_slides) as RawSlide[]; seed = row.id; }
      else console.log("no carousel in DB — using the sample deck");
    } catch {
      console.log("DB unreadable — using the sample deck");
    }
  }

  const slides = toKoyopoSlides(raw);
  const themes = themeArg ? [themeArg] : (Object.keys(SWIPE_THEMES) as SwipeThemeName[]);
  const outDir = path.join(process.cwd(), "public", "swipe-preview");
  await fs.mkdir(outDir, { recursive: true });

  for (const theme of themes) {
    const bufs = await renderSwipeDeck(slides, { canvas: "tall", seed, theme, author: "Alex Morgan" });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${theme}-${String(i + 1).padStart(2, "0")}.png`), bufs[i]);
    }
    console.log(`${theme}: ${bufs.length} slides`);
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
