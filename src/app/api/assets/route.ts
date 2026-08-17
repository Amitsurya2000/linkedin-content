import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateAsset, ASSET_KINDS, type AssetKind } from "@/lib/assets-gen";
import type { CreatorProfileData } from "@/lib/resume";

export const maxDuration = 180;

const VALID = new Set<string>(ASSET_KINDS.map((k) => k.kind));

/**
 * POST { kind, brief? } — generate one non-post LinkedIn asset.
 *
 * Everything routed through here runs on the user's Gemini key alone. No
 * second provider is involved in any asset the app produces.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    if (!VALID.has(kind)) {
      return NextResponse.json({ error: `Unknown asset kind "${kind}".` }, { status: 400 });
    }

    const [row] = await db
      .select({ profileJson: creatorProfiles.profileJson })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);
    if (!row?.profileJson) {
      return NextResponse.json(
        { error: "Build your profile first — upload your CV or fill the sections in on the Create page." },
        { status: 400 }
      );
    }

    const [key] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini")))
      .limit(1);
    if (!key) {
      return NextResponse.json({ error: "Add your Google Gemini API key in Settings first." }, { status: 400 });
    }

    const result = await generateAsset({
      apiKey: decrypt(key.encryptedKey, key.iv, key.authTag),
      kind: kind as AssetKind,
      profile: JSON.parse(row.profileJson) as CreatorProfileData,
      brief: typeof body.brief === "string" && body.brief.trim() ? body.brief.trim() : undefined,
      // Which angle to take. Coerced rather than trusted: the lib takes it
      // modulo the angle count, and NaN there would silently pick nothing.
      variant: Number.isFinite(Number(body.variant)) ? Number(body.variant) : 0,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate that asset";
    console.error("Asset generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
