/**
 * Store a Gemini API key, encrypted, for every account in the local database.
 *
 * The Settings UI is the normal path; this exists for when a key needs applying
 * to all accounts at once without logging into each.
 *
 *   npx tsx --env-file=.env.local scripts/set-gemini-key.ts <key>
 */
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { encrypt } from "../src/lib/crypto";

const key = process.argv[2];
if (!key) {
  console.error("usage: npx tsx --env-file=.env.local scripts/set-gemini-key.ts <key>");
  process.exit(1);
}

const db = new Database("./linkedin-posts.db");
const users = db.prepare("select id, email from users").all() as { id: string; email: string }[];

for (const u of users) {
  // A fresh IV per row: reusing one across records would weaken the encryption
  // for no benefit, since each row is written independently anyway.
  const enc = encrypt(key);
  const existing = db
    .prepare("select id from user_api_keys where user_id = ? and provider = 'gemini'")
    .get(u.id) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      "update user_api_keys set encrypted_key = ?, iv = ?, auth_tag = ?, key_prefix = ?, updated_at = ? where id = ?"
    ).run(enc.encrypted, enc.iv, enc.authTag, key.slice(0, 4), Date.now(), existing.id);
    console.log(`updated  ${u.email}`);
  } else {
    db.prepare(
      "insert into user_api_keys (id, user_id, provider, encrypted_key, key_prefix, iv, auth_tag, created_at, updated_at) values (?,?,?,?,?,?,?,?,?)"
    ).run(randomUUID(), u.id, "gemini", enc.encrypted, key.slice(0, 4), enc.iv, enc.authTag, Date.now(), Date.now());
    console.log(`inserted ${u.email}`);
  }
}
console.log(`done — ${users.length} account(s)`);
