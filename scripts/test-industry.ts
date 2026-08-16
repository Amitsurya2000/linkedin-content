/**
 * Isolates the Industry dropdown: same topic, same audience, same tone — only
 * the industry changes. If the two posts are near-identical, the control is
 * redundant with the creator profile and not worth keeping.
 *
 *   npx tsx --env-file=.env.local scripts/test-industry.ts
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
    topic: "Automating a manual reporting process that took 5 days",
    postType: "text" as const,
    postsCount: 1,
    targetAudience: "Team leads who own a recurring reporting process",
    tonePrefs: "Educational",
  };

  for (const industry of ["Finance / Fintech", "Healthcare", "Manufacturing"]) {
    const [post] = await generateLinkedInPosts({ ...base, industry });
    console.log(`\n── ${industry.toUpperCase()} ──`);
    console.log("hook:", post.hook);
    console.log("body:", post.body.split("\n").filter(Boolean).slice(0, 3).join(" / ").slice(0, 240));
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
