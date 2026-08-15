/**
 * Generates one carousel twice — draft only, then draft + scorecard pass — and
 * prints both covers, so the second pass is proven to change something.
 *
 *   npx tsx --env-file=.env.local scripts/test-refine.ts
 */
import Database from "better-sqlite3";
import { decrypt } from "../src/lib/crypto";
import { generateLinkedInPosts } from "../src/lib/gemini";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db.prepare("select encrypted_key, iv, auth_tag from user_api_keys where provider='gemini' limit 1")
    .get() as { encrypted_key: string; iv: string; auth_tag: string };
  const apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);

  const args = {
    apiKey,
    topic: "Month-end close automation in finance teams",
    postType: "carousel" as const,
    postsCount: 1,
    industry: "Finance / Fintech",
    slidesCount: 6,
  };

  console.log("── DRAFT (no scorecard pass) ──");
  const draft = await generateLinkedInPosts({ ...args, refine: false });
  console.log("cover:", draft[0].carouselSlides?.[0]?.title);
  console.log("slide2:", draft[0].carouselSlides?.[1]?.title);

  console.log("\n── WITH SCORECARD PASS ──");
  const refined = await generateLinkedInPosts(args);
  console.log("cover:", refined[0].carouselSlides?.[0]?.title);
  console.log("slide2:", refined[0].carouselSlides?.[1]?.title);
  console.log("takeaway2:", refined[0].carouselSlides?.[1]?.takeaway);
  console.log("closing:", refined[0].carouselSlides?.slice(-1)[0]?.title);
  console.log("slides:", refined[0].carouselSlides?.length);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
