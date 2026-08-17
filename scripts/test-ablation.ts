/**
 * Ablation: same topic, one input removed at a time. Shows what each detail is
 * actually worth by measuring what is lost without it.
 *
 *   npx tsx --env-file=.env.local scripts/test-ablation.ts
 */
import Database from "better-sqlite3";
import { decrypt } from "../src/lib/crypto";
import { generateLinkedInPosts } from "../src/lib/gemini";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db.prepare("select encrypted_key, iv, auth_tag from user_api_keys where provider='gemini' limit 1")
    .get() as { encrypted_key: string; iv: string; auth_tag: string };
  const apiKey = decrypt(row.encrypted_key, row.iv, row.auth_tag);

  const full = {
    apiKey,
    topic: "We cut month-end close from 5 days to 36 hours with Excel VBA",
    postType: "text" as const,
    postsCount: 1,
    industry: "Finance / Fintech",
    targetAudience: "CFOs and finance directors who sign off the budget",
    tonePrefs: "Provocative",
  };

  const runs: [string, typeof full][] = [
    ["EVERYTHING", full],
    ["NO AUDIENCE", { ...full, targetAudience: undefined as unknown as string }],
    ["NO TONE", { ...full, tonePrefs: undefined as unknown as string }],
    ["NO INDUSTRY", { ...full, industry: undefined as unknown as string }],
    ["TOPIC ONLY", { ...full, industry: undefined as unknown as string, targetAudience: undefined as unknown as string, tonePrefs: undefined as unknown as string }],
  ];

  for (const [label, args] of runs) {
    const [p] = await generateLinkedInPosts(args);
    console.log(`\n── ${label} ──`);
    console.log(`hook: ${p.hook}`);
    console.log(`open: ${p.body.split("\n").filter(Boolean)[1]?.slice(0, 120) ?? "-"}`);
    console.log(`cta : ${p.cta.slice(0, 90)}`);
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
