/**
 * Same topic, two audiences — proves the audience brief changes the output.
 *
 *   npx tsx --env-file=.env.local scripts/test-audience.ts
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
  };

  for (const [label, industry, audience] of [
    ["CFOs", "Finance / Fintech", "CFOs and finance directors who sign off the budget"],
    ["ENGINEERS", "Technology / SaaS", "Data engineers who build internal tooling"],
  ] as const) {
    const [post] = await generateLinkedInPosts({ ...base, industry, targetAudience: audience });
    console.log(`\n── ${label} ──`);
    console.log("hook:", post.hook);
    console.log("body:", post.body.split("\n").filter(Boolean).slice(0, 3).join(" / ").slice(0, 260));
    console.log("cta :", post.cta);
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
