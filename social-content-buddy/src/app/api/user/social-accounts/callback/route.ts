import { NextRequest, NextResponse } from "next/server";

/** GET — Handle OAuth redirect from GetLate after Instagram authorization.
 *  Redirects to settings with a sync flag so the UI refreshes accounts.
 */
export async function GET(req: NextRequest) {
  const url = new URL("/settings", req.url);
  url.searchParams.set("success", "instagram_connected");
  url.searchParams.set("sync", "1");
  return NextResponse.redirect(url);
}
