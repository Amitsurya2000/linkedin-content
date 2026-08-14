/**
 * Renders the newest carousel in the editorial (multi-colour) style, so the two
 * renderers can be compared on identical copy.
 *
 *   npx tsx scripts/deck-preview.ts
 */
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";
import { renderEditorialDeck, toKoyopoSlides, type RawSlide } from "../src/lib/deck-render";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db.prepare(
    `select gp.id, gp.carousel_slides from generated_posts gp
     join post_batches pb on pb.id = gp.batch_id
     where pb.post_type = 'carousel' and gp.carousel_slides is not null
     order by pb.created_at desc limit 1`
  ).get() as { id: string; carousel_slides: string } | undefined;
  if (!row) { console.log("no carousel posts"); return; }

  const slides = toKoyopoSlides(JSON.parse(row.carousel_slides) as RawSlide[]);
  const outDir = path.join(process.cwd(), "public", "deck-preview");
  await fs.mkdir(outDir, { recursive: true });

  for (const canvas of ["tall", "wide"] as const) {
    const bufs = await renderEditorialDeck(slides, { canvas, seed: row.id, deckTitle: "Amit Suryawanshi · AI/ML Engineer" });
    for (let i = 0; i < bufs.length; i++) {
      await fs.writeFile(path.join(outDir, `${canvas}-${String(i + 1).padStart(2, "0")}.png`), bufs[i]);
    }
    console.log(`${canvas}: ${bufs.length} slides`);
  }
  console.log(`wrote to ${outDir}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
