/**
 * Store a Gemini API key, encrypted, for every account in the database.
 *
 * The Settings UI is the normal path; this exists for when a key needs applying
 * to all accounts at once without logging into each.
 *
 *   npx tsx scripts/set-gemini-key.ts <key>
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, userApiKeys } from "../src/lib/db/schema";
import { encrypt } from "../src/lib/crypto";

const key = process.argv[2];
if (!key) {
  console.error("usage: npx tsx scripts/set-gemini-key.ts <key>");
  process.exit(1);
}

async function main() {
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);

  for (const u of allUsers) {
    // A fresh IV per row: reusing one across records would weaken the encryption
    // for no benefit, since each row is written independently anyway.
    const enc = encrypt(key);
    const existing = await db
      .select({ id: userApiKeys.id })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, u.id));

    if (existing.length > 0) {
      await db
        .update(userApiKeys)
        .set({
          encryptedKey: enc.encrypted,
          iv: enc.iv,
          authTag: enc.authTag,
          keyPrefix: key.slice(0, 4),
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.userId, u.id));
      console.log(`updated  ${u.email}`);
    } else {
      await db.insert(userApiKeys).values({
        userId: u.id,
        provider: "gemini",
        encryptedKey: enc.encrypted,
        keyPrefix: key.slice(0, 4),
        iv: enc.iv,
        authTag: enc.authTag,
      });
      console.log(`inserted ${u.email}`);
    }
  }
  console.log(`done — ${allUsers.length} account(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
