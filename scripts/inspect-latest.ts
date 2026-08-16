/**
 * Prints the newest carousel's actual copy, so output can be judged from the
 * data rather than from a screenshot.
 *
 *   npx tsx scripts/inspect-latest.ts
 */
import Database from "better-sqlite3";

interface Slide { title?: string; body?: string; takeaway?: string; slideTemplate?: string }

const db = new Database("./linkedin-posts.db");
const post = db.prepare(`
  select gp.id, gp.hook, gp.carousel_slides, gp.carousel_images
  from generated_posts gp
  join post_batches pb on pb.id = gp.batch_id
  where pb.post_type = 'carousel' and gp.carousel_slides is not null
  order by pb.created_at desc limit 1
`).get() as { id: string; hook: string; carousel_slides: string; carousel_images: string | null } | undefined;

if (!post) {
  console.log("no carousel posts yet");
} else {
  const slides = JSON.parse(post.carousel_slides) as Slide[];
  console.log(`post ${post.id.slice(0, 8)} · ${slides.length} slides`);
  console.log(`hook: ${post.hook}\n`);
  slides.forEach((s, i) => {
    console.log(`── ${i + 1} [${s.slideTemplate ?? "?"}]`);
    console.log(`   title    : ${s.title ?? ""}`);
    console.log(`   body     : ${String(s.body ?? "").replace(/\n/g, " ⏎ ").slice(0, 170)}`);
    console.log(`   takeaway : ${s.takeaway ?? "(none)"}`);
  });
  const imgs: string[] = post.carousel_images ? JSON.parse(post.carousel_images) : [];
  console.log(`\nrendered images: ${imgs.length}`);
  if (imgs[1]) console.log(`sample: ${imgs[1]}`);
}
