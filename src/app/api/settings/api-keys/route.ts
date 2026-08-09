import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userApiKeys } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";

/** GET — List user's API keys (provider, prefix, createdAt — NEVER the actual key) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await db
      .select({
        id: userApiKeys.id,
        provider: userApiKeys.provider,
        keyPrefix: userApiKeys.keyPrefix,
        createdAt: userApiKeys.createdAt,
        updatedAt: userApiKeys.updatedAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, session.user.id));

    return NextResponse.json(keys);
  } catch (err) {
    console.error("Get API keys error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST — Save/upsert an API key. Takes { provider, apiKey }. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider, apiKey } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 4) {
      return NextResponse.json(
        { error: "A valid apiKey is required" },
        { status: 400 }
      );
    }

    const keyPrefix = apiKey.substring(0, 4) + "..." + apiKey.slice(-4);
    const { encrypted, iv, authTag } = encrypt(apiKey);

    // Check if key already exists for this provider
    const [existing] = await db
      .select({ id: userApiKeys.id })
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, provider)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing key
      await db
        .update(userApiKeys)
        .set({
          encryptedKey: encrypted,
          keyPrefix,
          iv,
          authTag,
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.id, existing.id));
    } else {
      // Insert new key
      await db.insert(userApiKeys).values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        provider,
        encryptedKey: encrypted,
        keyPrefix,
        iv,
        authTag,
      });
    }

    return NextResponse.json({ provider, keyPrefix });
  } catch (err) {
    console.error("Save API key error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** DELETE — Remove API key by provider (?provider=gemini) */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "provider query param is required" },
        { status: 400 }
      );
    }

    const result = await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, session.user.id),
          eq(userApiKeys.provider, provider)
        )
      )
      .returning({ id: userApiKeys.id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: "API key not found for this provider" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, provider });
  } catch (err) {
    console.error("Delete API key error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
