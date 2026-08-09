/**
 * Seed script: creates a default user for the LinkedIn Post Generator.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Make sure .env.local exists with DATABASE_URL before running.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import bcryptjs from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const { users } = schema;

const sqlite = new Database(process.env.DATABASE_URL || "./linkedin-posts.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

const USER_NAME = "Rajan";
const USER_EMAIL = "rajan@example.com";
const USER_PASSWORD = "LinkedIn123!";

async function main() {
  console.log("Seeding database...\n");

  // Check if user already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, USER_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`User already exists: ${USER_EMAIL}`);
  } else {
    const passwordHash = await bcryptjs.hash(USER_PASSWORD, 12);
    await db.insert(users).values({
      name: USER_NAME,
      email: USER_EMAIL,
      password: passwordHash,
    });
    console.log(`Created user:`);
    console.log(`  Name:     ${USER_NAME}`);
    console.log(`  Email:    ${USER_EMAIL}`);
    console.log(`  Password: ${USER_PASSWORD}`);
  }

  console.log("\nSeed complete!");
  sqlite.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  sqlite.close();
  process.exit(1);
});
