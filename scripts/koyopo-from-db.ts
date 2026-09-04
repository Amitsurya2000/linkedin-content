/**
 * Renders the newest carousel post in the database through the KOYOPO pipeline,
 * so real generated copy can be checked against the templates without going via
 * the authenticated API route.
 *
 *   npx tsx scripts/koyopo-from-db.ts
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../src/lib/db";
import { generatedPosts, postBatches } from "../src/lib/db/schema";
import { renderDeck, toKoyopoSlides, type RawSlide } from "../src/lib/koyopo";
import { buildPptx } from "../src/lib/koyopo-pptx";

async function main() {
  const rows = await db
    .select({ id: generatedPosts.id, carouselSlides: generatedPosts.carouselSlides })
    .from(generatedPosts)
    .innerJoin(postBatches, eq(postBatches.id, generatedPosts.batchId))
    .where(and(eq(postBatches.postType, "carousel"), isNotNull(generatedPosts.carouselSlides)))
    .orderBy(postBatches.createdAt)
    .limit(1);

  const row = rows[0];
  if (!row) { console.log("no carousel posts in the database"); return; }

  const raw = row.carouselSlides as RawSlide[];
  console.log(`post ${row.id.slice(0, 8)} — ${raw.length} slides`);
  raw.forEach((s, i) => console.log(`  ${i + 1}. template=${s.slideTemplate ?? "(none)"}  tag=${s.sectionTag ?? "(none)"}  "${(s.title ?? "").slice(0, 50)}"`));

  const slides = toKoyopoSlides(raw);

  const outDir = path.join(process.cwd(), "public", "koyopo-preview", "from-db");
  await fs.mkdir(outDir, { recursive: true });

  const buffers = await renderDeck(slides, { canvas: "tall", deckTitle: "1Cr+ Career OS" });
  for (let i = 0; i < buffers.length; i++) {
    await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`), buffers[i]);
  }
  const pptx = await buildPptx(slides, { canvas: "wide", deckTitle: "1Cr+ Career OS" });
  await fs.writeFile(path.join(outDir, "deck.pptx"), pptx);

  console.log(`\nwrote ${buffers.length} PNGs + deck.pptx to ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
