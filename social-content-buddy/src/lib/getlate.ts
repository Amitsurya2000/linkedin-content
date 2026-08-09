const API_BASE = "https://getlate.dev/api";

interface GetLateAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  name?: string;
}

interface GetLateProfile {
  _id: string;
  name: string;
}

interface GetLatePostResult {
  id: string;
  status: string;
}

async function getlateRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: object
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`GetLate API error ${res.status}: ${text}`);
  }

  return res.json();
}

/** Get or create a GetLate profile (needed for connecting accounts) */
export async function getOrCreateProfile(apiKey: string): Promise<string> {
  // Try to list existing profiles first
  try {
    const data = await getlateRequest(apiKey, "GET", "/v1/profiles");
    const profiles = Array.isArray(data) ? data : data.profiles ?? [];
    if (profiles.length > 0) {
      return profiles[0]._id;
    }
  } catch {
    // If listing fails, just create a new one
  }

  // Create a new profile
  const data = await getlateRequest(apiKey, "POST", "/v1/profiles", {
    name: "PostAI",
    description: "Connected via PostAI",
  });
  const profileId = data._id ?? data.profile?._id;
  if (!profileId) {
    throw new Error("Failed to create GetLate profile: no ID in API response");
  }
  return profileId;
}

/** Get the OAuth connect URL for Instagram */
export async function getConnectUrl(
  apiKey: string,
  profileId: string,
  callbackUrl: string
): Promise<string> {
  const params = new URLSearchParams({
    profileId,
    callbackUrl,
  });

  const res = await fetch(`${API_BASE}/v1/connect/instagram?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`GetLate connect error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.authUrl ?? data.url;
}

/** List all connected social accounts */
export async function listAccounts(apiKey: string): Promise<GetLateAccount[]> {
  const data = await getlateRequest(apiKey, "GET", "/v1/accounts");
  const accounts = Array.isArray(data) ? data : data.accounts ?? [];
  return accounts.map((a: Record<string, string>) => ({
    _id: a._id ?? a.id,
    platform: a.platform ?? "instagram",
    username: a.username ?? a.name,
    displayName: a.displayName ?? a.name ?? a.username,
  }));
}

/** Publish a post to a social account immediately */
export async function publishPost(
  apiKey: string,
  options: {
    content: string;
    imageUrl: string;
    accountId: string;
  }
): Promise<GetLatePostResult> {
  const data = await getlateRequest(apiKey, "POST", "/v1/posts", {
    content: options.content,
    publishNow: true,
    platforms: [
      {
        platform: "instagram",
        accountId: options.accountId,
      },
    ],
    mediaItems: [{ type: "image", url: options.imageUrl }],
  });
  return { id: data._id ?? data.id ?? data.postId, status: data.status ?? "published" };
}

/** Ensure a webhook is registered for post.published events.
 *  Idempotent — skips creation if one already exists pointing at our URL. */
export async function ensureWebhook(apiKey: string): Promise<void> {
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL;
  if (!appUrl) return; // can't register without knowing our public URL

  const webhookUrl = `${appUrl}/api/webhooks/getlate`;

  try {
    // Check if webhook already exists
    const data = await getlateRequest(apiKey, "GET", "/v1/webhooks/settings");
    const webhooks = Array.isArray(data) ? data : data.webhooks ?? [];
    const exists = webhooks.some(
      (w: { url?: string; isActive?: boolean }) =>
        w.url === webhookUrl && w.isActive !== false
    );
    if (exists) return;

    // Register new webhook (include secret for HMAC verification if configured)
    const webhookConfig: Record<string, unknown> = {
      name: "PostAI Status Sync",
      url: webhookUrl,
      events: ["post.published", "post.failed"],
    };
    const secret = process.env.GETLATE_WEBHOOK_SECRET;
    if (secret) webhookConfig.secret = secret;
    await getlateRequest(apiKey, "POST", "/v1/webhooks/settings", webhookConfig);
  } catch (err) {
    // Non-critical — log but don't block the user flow
    console.error("Failed to register GetLate webhook:", err);
  }
}

/** Schedule a post to a social account for later */
export async function schedulePost(
  apiKey: string,
  options: {
    content: string;
    imageUrl: string;
    accountId: string;
    scheduledAt: string; // ISO 8601
  }
): Promise<GetLatePostResult> {
  const data = await getlateRequest(apiKey, "POST", "/v1/posts", {
    content: options.content,
    scheduledFor: options.scheduledAt,
    platforms: [
      {
        platform: "instagram",
        accountId: options.accountId,
      },
    ],
    mediaItems: [{ type: "image", url: options.imageUrl }],
  });
  return { id: data._id ?? data.id ?? data.postId, status: data.status ?? "scheduled" };
}
