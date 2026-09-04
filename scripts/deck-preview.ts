/**
 * Renders the newest carousel in the editorial (multi-colour) style, so the two
 * renderers can be compared on identical copy.
 *
 *   npx tsx scripts/deck-preview.ts
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../src/lib/db";
import { generatedPosts, postBatches } from "../src/lib/db/schema";
import { renderEditorialDeck, toKoyopoSlides, type RawSlide } from "../src/lib/deck-render";

async function main() {
  const rows = await db
    .select({ id: generatedPosts.id, carouselSlides: generatedPosts.carouselSlides })
    .from(generatedPosts)
    .innerJoin(postBatches, eq(postBatches.id, generatedPosts.batchId))
    .where(and(eq(postBatches.postType, "carousel"), isNotNull(generatedPosts.carouselSlides)))
    .orderBy(postBatches.createdAt)
    .limit(1);

  const row = rows[0];
  if (!row) { console.log("no carousel posts"); return; }

  const slides = toKoyopoSlides(row.carouselSlides as RawSlide[]);
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
