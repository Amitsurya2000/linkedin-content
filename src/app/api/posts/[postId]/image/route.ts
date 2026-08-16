import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches, creatorProfiles, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateBackground } from "@/lib/image-engine";
import { buildStyledPrompt, STYLE_BY_ID, DEFAULT_STYLE_IDS } from "@/lib/image-prompt";
import { composeCard } from "@/lib/compose";

export const maxDuration = 300;

/** POST — Generate a premium Gemini image for a post (verify ownership). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No server-side configuration gate any more: image generation uses the
  // user's own Gemini key, which is checked below alongside the post lookup.

  try {
    const { postId } = await params;
    const body = await req.json().catch(() => ({}));
    // Resolve the requested style: a specific id, or "auto"/none → pick one
    // (rotate by index when provided, else random) for premium variety.
    let styleId: string;
    if (typeof body.style === "string" && STYLE_BY_ID[body.style]) {
      styleId = body.style;
    } else {
      // "auto": pick from the curated on-brand pool (authority + authentic).
      const pool = DEFAULT_STYLE_IDS;
      const idx = Number.isInteger(body.index)
        ? body.index
        : Math.floor(Math.random() * pool.length);
      styleId = pool[((idx % pool.length) + pool.length) % pool.length];
    }

    // Verify ownership + fetch post
    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Pull the batch topic/industry for richer prompting, and any images the
    // client uploaded with the brief.
    const [batch] = await db
      .select({
        topic: postBatches.topic,
        industry: postBatches.industry,
        referenceImages: postBatches.referenceImages,
      })
      .from(postBatches)
      .where(eq(postBatches.id, post.batchId))
      .limit(1);

    // Author name for the quote-card sign-off (from the client's profile).
    const [prof] = await db
      .select({ fullName: creatorProfiles.fullName })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, session.user.id))
      .limit(1);

    const { prompt, width, height, styleName, overlay } = buildStyledPrompt(
      {
        hook: post.hook,
        hookCategory: post.hookCategory,
        topic: batch?.topic || undefined,
        industry: batch?.industry || undefined,
        cta: post.cta || undefined,
        author: prof?.fullName || undefined,
      },
      styleId
    );

    // Gathos when it is configured, Gemini otherwise — see lib/image-engine.ts.
    // The Gemini key is optional here: it is only needed if Gathos is absent or
    // its request fails.
    const [keyRow] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, "gemini")))
      .limit(1);

    // An uploaded screenshot beats a generated one outright: it is the real
    // thing, it is free, and it is instant. Generate only when the client
    // supplied nothing, or explicitly asked for a fresh visual.
    const uploads: string[] = batch?.referenceImages ? safeParse(batch.referenceImages, []) : [];
    if (uploads.length && body.useUpload !== false) {
      const pick = uploads[Math.abs(Number(body.index) || 0) % uploads.length];
      try {
        const raw = await fs.readFile(path.join(process.cwd(), "public", pick.replace(/^\//, "")));
        let buf: Buffer = raw;
        if (overlay?.text) {
          try {
            buf = await composeCard(raw, { width, height, text: overlay.text, theme: overlay.theme });
          } catch (e) {
            console.error("overlay failed on the upload, using it raw:", e);
          }
        }
        const upDir = path.join(process.cwd(), "public", "generated");
        await fs.mkdir(upDir, { recursive: true });
        const upName = `${postId}-upload-${Date.now()}.png`;
        await fs.writeFile(path.join(upDir, upName), buf);
        const upUrl = `/generated/${upName}`;
        await db.update(generatedPosts).set({ imageUrl: upUrl }).where(eq(generatedPosts.id, postId));
        return NextResponse.json({ imageUrl: upUrl, style: styleId, styleName, engine: "upload", elapsedMs: 0 });
      } catch (e) {
        // A missing or unreadable upload falls through to generation rather
        // than failing the request.
        console.error("Could not use the uploaded image, generating instead:", e);
      }
    }

    const img = await generateBackground(prompt, {
      width,
      height,
      geminiKey: keyRow ? decrypt(keyRow.encryptedKey, keyRow.iv, keyRow.authTag) : undefined,
    });
    let outBuf: Buffer = img.buffer;
    if (overlay && overlay.text) {
      try {
        outBuf = await composeCard(outBuf, { width, height, text: overlay.text, theme: overlay.theme });
      } catch (e) {
        console.error("compose overlay failed, using raw bg:", e);
      }
    }

    // Persist to /public/generated so it's served statically
    const dir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${postId}-${styleId}-${Date.now()}.png`;
    await fs.writeFile(path.join(dir, filename), outBuf);
    const imageUrl = `/generated/${filename}`;

    await db
      .update(generatedPosts)
      .set({ imageUrl })
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({
      imageUrl,
      style: styleId,
      styleName,
      engine: img.engine,
      model: img.model,
      elapsedMs: img.elapsedMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    console.error("Image generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


function safeParse<T>(v: string, fb: T): T {
  try { return JSON.parse(v); } catch { return fb; }
}
