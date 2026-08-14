/**
 * Lists the models the stored Gemini key can actually reach, so model IDs are
 * chosen from the API rather than guessed.
 *
 *   npx tsx --env-file=.env.local scripts/list-gemini-models.ts
 */
import Database from "better-sqlite3";
import { decrypt } from "../src/lib/crypto";

async function main() {
  const db = new Database("./linkedin-posts.db");
  const row = db
    .prepare("select encrypted_key, iv, auth_tag from user_api_keys where provider='gemini' limit 1")
    .get() as { encrypted_key: string; iv: string; auth_tag: string } | undefined;
  if (!row) { console.log("no gemini key stored"); return; }

  const key = decrypt(row.encrypted_key, row.iv, row.auth_tag);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1000`);
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[]; error?: { message: string } };

  if (data.error) { console.log("API ERROR:", data.error.message); return; }
  const all = data.models ?? [];
  console.log(`total models: ${all.length}`);

  const imaging = all.filter((m) => /image|imagen|banana/i.test(m.name));
  console.log(`\nIMAGE-CAPABLE (${imaging.length}):`);
  for (const m of imaging) {
    console.log(`  ${m.name.replace("models/", "")}  [${(m.supportedGenerationMethods ?? []).join(", ")}]`);
  }

  console.log(`\nGEMINI 3.x TEXT:`);
  for (const m of all.filter((m) => /gemini-3/i.test(m.name)).slice(0, 12)) {
    console.log(`  ${m.name.replace("models/", "")}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
