/**
 * Same topic and audience, different tone — measures whether the tone setting
 * actually changes anything.
 *
 *   npx tsx --env-file=.env.local scripts/test-tone.ts
 */
import Database from "better-sqlite3";
import { decrypt } from "../src/lib/crypto";
import { generateLinkedInPosts } from "../src/lib/gemini";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db.prepare("select encrypted_key, iv, auth_tag from user_api_keys where provider='gemini' limit 1")
    .get() as { encrypted_key: string; iv: string; auth_tag: string };
  const apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);

  const base = {
    apiKey,
    topic: "We cut month-end close from 5 days to 36 hours with Excel VBA",
    postType: "text" as const,
    postsCount: 1,
    industry: "Finance / Fintech",
    targetAudience: "FP&A managers and controllers at mid-market companies",
  };

  for (const tone of ["Professional", "Provocative", "Storytelling"]) {
    const [post] = await generateLinkedInPosts({ ...base, tonePrefs: tone });
    console.log(`\n── ${tone.toUpperCase()} ──`);
    console.log("hook:", post.hook);
    console.log("open:", post.body.split("\n").filter(Boolean).slice(0, 2).join(" / ").slice(0, 200));
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
