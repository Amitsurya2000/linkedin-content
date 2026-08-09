/**
 * Seed script: creates the first admin user and initial invitation codes.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Set DATABASE_URL in .env.local before running.
 */
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcryptjs from "bcryptjs";
import * as schema from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const { users, invitationCodes } = schema;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@socialpostauto.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin1234!";
const ADMIN_NAME = "Admin";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create admin user
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  let adminId: string;

  if (existing.length > 0) {
    adminId = existing[0].id;
    console.log(`✓ Admin user already exists (${ADMIN_EMAIL})`);
    // Ensure is_admin is set
    await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, adminId));
  } else {
    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
    const [newUser] = await db
      .insert(users)
      .values({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: passwordHash,
        isAdmin: true,
        creditsLimit: 9999,
      })
      .returning({ id: users.id });
    adminId = newUser.id;
    console.log(`✓ Created admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  // Generate 10 invitation codes
  console.log("\n📬 Generating 10 invitation codes...");
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    await db.insert(invitationCodes).values({
      code,
      createdBy: adminId,
    });
    codes.push(code);
  }

  console.log("\n🎟  Invitation codes:");
  codes.forEach((c) => console.log(`   ${c}`));

  console.log("\n✅ Seed complete!");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
