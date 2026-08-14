import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateProfileKit, type ProfileKit } from "@/lib/profile-kit";
import type { CreatorProfileData } from "@/lib/resume";

export const maxDuration = 120;

async function getGeminiKey(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini")))
    .limit(1);
  if (!row) return null;
  return decrypt(row.encryptedKey, row.iv, row.authTag);
}

/** GET — the saved kit, or null if it has not been generated yet. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ kitJson: creatorProfiles.kitJson, profileJson: creatorProfiles.profileJson })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, session.user.id))
    .limit(1);

  return NextResponse.json({
    kit: row?.kitJson ? (JSON.parse(row.kitJson) as ProfileKit) : null,
    hasProfile: !!row?.profileJson,
  });
}

/** POST — generate (or regenerate) the kit from the stored creator profile. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = await req.json().catch(() => ({}));

    const [row] = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);

    if (!row?.profileJson) {
      return NextResponse.json(
        { error: "Build your profile first — upload your CV or fill the sections in on the Create page." },
        { status: 400 }
      );
    }

    const apiKey = await getGeminiKey(userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Add your Google Gemini API key in Settings first — it writes the banner, headline and About copy." },
        { status: 400 }
      );
    }

    const kit = await generateProfileKit({
      apiKey,
      profile: JSON.parse(row.profileJson) as CreatorProfileData,
      targetRole: typeof body.targetRole === "string" ? body.targetRole.trim() : undefined,
      email: typeof body.email === "string" ? body.email.trim() : session.user.email ?? undefined,
    });

    await db
      .update(creatorProfiles)
      .set({ kitJson: JSON.stringify(kit), updatedAt: new Date() })
      .where(eq(creatorProfiles.id, row.id));

    return NextResponse.json({ kit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build your profile kit";
    console.error("Profile kit error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
