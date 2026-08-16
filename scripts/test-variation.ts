/**
 * Generates a batch of 3 carousels from ONE topic and prints the spine of each,
 * to show whether the deck types and hooks genuinely differ per post.
 *
 *   npx tsx --env-file=.env.local scripts/test-variation.ts
 */
import Database from "better-sqlite3";
import { decrypt } from "../src/lib/crypto";
import { generateLinkedInPosts } from "../src/lib/gemini";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db.prepare("select encrypted_key, iv, auth_tag from user_api_keys where provider='gemini' limit 1")
    .get() as { encrypted_key: string; iv: string; auth_tag: string };

  const posts = await generateLinkedInPosts({
    apiKey: decrypt(row.encrypted_key, row.iv, row.auth_tag),
    topic: "We cut month-end close from 5 days to 36 hours with Excel VBA",
    postType: "carousel",
    postsCount: 3,
    industry: "Finance / Fintech",
    targetAudience: "FP&A managers and controllers at mid-market companies",
    tonePrefs: "Educational",
    slidesCount: 6,
  });

  posts.forEach((p, i) => {
    const s = p.carouselSlides ?? [];
    console.log(`\n━━━ POST ${i + 1} ━━━  hook archetype: ${p.hookCategory}`);
    console.log(`cover  : ${s[0]?.title ?? "-"}`);
    console.log(`slide2 : ${s[1]?.title ?? "-"}`);
    console.log(`slide3 : ${s[2]?.title ?? "-"}`);
    console.log(`closing: ${s[s.length - 1]?.title ?? "-"}`);
    console.log(`shape  : ${s.map((x) => x.slideTemplate ?? "?").join(" → ")}`);
  });
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
