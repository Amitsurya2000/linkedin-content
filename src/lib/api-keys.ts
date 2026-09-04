/**
 * Resolve the Gemini API key for a user.
 *
 * Priority:
 *   1. Per-user key stored in the DB (BYOK, encrypted at rest)
 *   2. Server-side GEMINI_API_KEY from .env.local
 *
 * Returns null only when neither exists — callers should return 400 in that case.
 */
import { db } from "./db";
import { userApiKeys } from "./db/schema";
import { decrypt } from "./crypto";
import { eq, and } from "drizzle-orm";

export async function resolveGeminiKey(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini")))
    .limit(1);

  if (row) return decrypt(row.encryptedKey, row.iv, row.authTag);

  return process.env.GEMINI_API_KEY || null;
}
