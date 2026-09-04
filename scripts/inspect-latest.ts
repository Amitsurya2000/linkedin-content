/**
 * Prints the newest carousel's actual copy, so output can be judged from the
 * data rather than from a screenshot.
 *
 *   npx tsx scripts/inspect-latest.ts
 */
import "dotenv/config";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../src/lib/db";
import { generatedPosts, postBatches } from "../src/lib/db/schema";

interface Slide { title?: string; body?: string; takeaway?: string; slideTemplate?: string }

async function main() {
  const row = await db
    .select({
      id: generatedPosts.id,
      hook: generatedPosts.hook,
      carouselSlides: generatedPosts.carouselSlides,
      carouselImages: generatedPosts.carouselImages,
    })
    .from(generatedPosts)
    .innerJoin(postBatches, eq(postBatches.id, generatedPosts.batchId))
    .where(and(eq(postBatches.postType, "carousel"), isNotNull(generatedPosts.carouselSlides)))
    .orderBy(postBatches.createdAt)
    .limit(1);

  const post = row[0];

  if (!post) {
    console.log("no carousel posts yet");
  } else {
    const slides = (post.carouselSlides ?? []) as Slide[];
    console.log(`post ${post.id.slice(0, 8)} · ${slides.length} slides`);
    console.log(`hook: ${post.hook}\n`);
    slides.forEach((s, i) => {
      console.log(`── ${i + 1} [${s.slideTemplate ?? "?"}]`);
      console.log(`   title    : ${s.title ?? ""}`);
      console.log(`   body     : ${String(s.body ?? "").replace(/\n/g, " ⏎ ").slice(0, 170)}`);
      console.log(`   takeaway : ${s.takeaway ?? "(none)"}`);
    });
    const imgs: string[] = (post.carouselImages ?? []) as string[];
    console.log(`\nrendered images: ${imgs.length}`);
    if (imgs[1]) console.log(`sample: ${imgs[1]}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
