import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserApiKey } from "@/lib/crypto";
import { getOrCreateProfile, getConnectUrl } from "@/lib/getlate";

/** POST — Generate GetLate OAuth connect URL for Instagram */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getUserApiKey(session.user.id, "getlate");
  if (!apiKey) {
    return NextResponse.json(
      { error: "Please add your GetLate API key in Settings first" },
      { status: 400 }
    );
  }

  // Build callback URL back to our app
  const origin = new URL(req.url).origin;
  const callbackUrl = `${origin}/api/user/social-accounts/callback`;

  try {
    // Get or create a GetLate profile, then generate connect URL
    const profileId = await getOrCreateProfile(apiKey);
    const authUrl = await getConnectUrl(apiKey, profileId, callbackUrl);
    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error("GetLate connect error:", err);
    return NextResponse.json(
      { error: "Failed to generate connect URL. Check your GetLate API key." },
      { status: 500 }
    );
  }
}
