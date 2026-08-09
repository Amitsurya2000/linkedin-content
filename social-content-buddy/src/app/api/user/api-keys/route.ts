import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userApiKeys } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";

const VALID_PROVIDERS = ["gemini", "fal", "getlate"] as const;

const saveSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
  apiKey: z.string().min(1),
});

const deleteSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
});

/** GET — Return key metadata only (never the actual key) */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await db
      .select({
        id: userApiKeys.id,
        provider: userApiKeys.provider,
        keyPrefix: userApiKeys.keyPrefix,
        createdAt: userApiKeys.createdAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, session.user.id));

    return NextResponse.json(keys);
  } catch (err) {
    console.error("API keys GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — Save (upsert) an encrypted API key */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { provider, apiKey } = parsed.data;
    const userId = session.user.id;
    const keyPrefix = apiKey.slice(0, 4);
    const { encrypted, iv, authTag } = encrypt(apiKey);

    // Delete existing key for this provider if any
    await db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));

    // Insert new
    await db.insert(userApiKeys).values({
      userId,
      provider,
      encryptedKey: encrypted,
      keyPrefix,
      iv,
      authTag,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API keys POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — Revoke a key by provider */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, parsed.data.provider)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API keys DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
