import crypto from "crypto";

/**
 * Slack helpers: request verification and the deferred reply.
 *
 * Two things about Slack shape everything below.
 *
 * It requires an acknowledgement within THREE SECONDS. Generation here takes 30
 * to 90, so the command handler cannot do the work and answer at the same time.
 * It acks immediately and posts the real answer afterwards to `response_url`,
 * which stays valid for 30 minutes and accepts five sends.
 *
 * And the endpoint is public by definition — Slack has to reach it, so anyone
 * else can too. Every request is verified against the signing secret before it
 * is read, which is why the raw body is needed rather than a parsed one.
 */

const SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";

export function isSlackConfigured(): boolean {
  return Boolean(SIGNING_SECRET);
}

/**
 * Verify a request really came from Slack.
 *
 * The timestamp check is not optional: without it a captured request could be
 * replayed forever, because the signature over an unchanged body stays valid.
 * Five minutes is Slack's own recommended window.
 *
 * timingSafeEqual is used rather than `===` so the comparison cannot be timed to
 * recover the expected signature byte by byte.
 */
export function verifySlackRequest(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): { ok: true } | { ok: false; reason: string } {
  if (!SIGNING_SECRET) return { ok: false, reason: "SLACK_SIGNING_SECRET is not set" };
  if (!signature || !timestamp) return { ok: false, reason: "missing signature headers" };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) {
    return { ok: false, reason: "timestamp outside the 5 minute window" };
  }

  const expected =
    "v0=" +
    crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

/**
 * Send the real answer once the work is done.
 *
 * `response_type: "in_channel"` makes it visible to everyone rather than only
 * the person who typed the command — a generated post is usually for the team.
 */
export async function respond(
  responseUrl: string,
  body: { text: string; blocks?: SlackBlock[]; response_type?: "in_channel" | "ephemeral" }
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_type: "in_channel", ...body }),
    });
  } catch (err) {
    // The command already returned; there is nobody left to tell.
    console.error("Slack response_url post failed:", err);
  }
}

/** Slack's section blocks cap at 3000 characters and truncate silently. */
export function section(text: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text: text.slice(0, 2900) } };
}

export function context(text: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text: text.slice(0, 2900) }] };
}

export const divider: SlackBlock = { type: "divider" };
