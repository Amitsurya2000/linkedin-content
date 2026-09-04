/**
 * Lists the models the stored Gemini key can actually reach, so model IDs are
 * chosen from the API rather than guessed.
 *
 *   npx tsx scripts/list-gemini-models.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { userApiKeys } from "../src/lib/db/schema";
import { decrypt } from "../src/lib/crypto";

async function main() {
  const rows = await db
    .select({ encryptedKey: userApiKeys.encryptedKey, iv: userApiKeys.iv, authTag: userApiKeys.authTag })
    .from(userApiKeys)
    .where(eq(userApiKeys.provider, "gemini"))
    .limit(1);

  const row = rows[0];
  if (!row) { console.log("no gemini key stored"); return; }

  const key = decrypt(row.encryptedKey, row.iv, row.authTag);
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
