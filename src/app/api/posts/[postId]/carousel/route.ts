import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generatedPosts, postBatches, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateBackground, hasImageEngine } from "@/lib/image-engine";
import { buildStyledPrompt } from "@/lib/image-prompt";
import { composeSlide, type SlideSpec, type OverlayTheme } from "@/lib/compose";

export const maxDuration = 300;

// Clean, EVEN backgrounds only — carousels need consistent legibility behind
// multi-line text, so gradients / photos / busy styles are excluded.
const CAROUSEL_STYLES = [
  "authority-quote", "authority-glow", "authority-smoke", "executive-navy", "charcoal-gold",
];

interface Slide { slideNumber?: number; title: string; body?: string }

/** POST — generate a multi-slide carousel (cover + content slides + CTA). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Backgrounds come from the user's Gemini key — checked with the post below.

  try {
    const { postId } = await params;
    const body = await req.json().catch(() => ({}));

    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Render EVERY slide Gemini wrote (capped at 5, matching the generation rule).
    const allSlides: Slide[] = post.carouselSlides ? safeParse(post.carouselSlides, []) : [];
    const slides = allSlides.slice(0, 5);

    const [batch] = await db
      .select({ topic: postBatches.topic, industry: postBatches.industry })
      .from(postBatches)
      .where(eq(postBatches.id, post.batchId))
      .limit(1);

    // Choose one cohesive style for the whole deck.
    const styleId =
      typeof body.style === "string" && CAROUSEL_STYLES.includes(body.style)
        ? body.style
        : CAROUSEL_STYLES[Math.floor(Math.random() * CAROUSEL_STYLES.length)];

    const built = buildStyledPrompt(
      { hook: post.hook, hookCategory: post.hookCategory, topic: batch?.topic || undefined, industry: batch?.industry || undefined, cta: post.cta || undefined },
      styleId
    );
    const theme: OverlayTheme = built.overlay?.theme ?? { fg: "#FFFFFF", accent: "#C9A227", font: "serif", align: "center", scrim: "none" };
    const { width, height } = built;

    const [keyRow] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, "gemini")))
      .limit(1);
    const geminiKey = keyRow
      ? decrypt(keyRow.encryptedKey, keyRow.iv, keyRow.authTag)
      : undefined;
    if (!hasImageEngine(geminiKey)) {
      return NextResponse.json(
        { error: "No image engine configured — add your Google Gemini key in Settings, or set the server Gathos key." },
        { status: 400 }
      );
    }

    // One shared, cohesive background for the whole carousel (fast + consistent).
    // Gathos when configured server-side, else the user's Gemini key.
    const bg = await generateBackground({ prompt: built.prompt, width, height, geminiKey });
    const bgBuf = bg.buffer;

    // One image per Gemini slide — nothing dropped, nothing truncated. Slide 1 =
    // cover, last = CTA, the rest = content. Full copy is rendered verbatim.
    const badge = theme.badge || "Carousel";
    const specs: SlideSpec[] = [];
    if (slides.length === 0) {
      specs.push({ kind: "cover", badge, title: post.hook });
      specs.push({ kind: "cta", title: post.cta || "Follow for more", badge });
    } else {
      const total = slides.length;
      slides.forEach((s, i) => {
        const cleanBody = (s.body || "").replace(/\s+/g, " ").trim();
        if (i === 0) {
          specs.push({ kind: "cover", badge, title: s.title || post.hook });
        } else if (i === slides.length - 1) {
          specs.push({ kind: "cta", title: s.title || post.cta || "Follow for more", badge });
        } else {
          specs.push({
            kind: "content",
            number: String(i).padStart(2, "0"),
            title: s.title,
            body: cleanBody,
            footer: `${i + 1} / ${total}`,
          });
        }
      });
    }

    const dir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(dir, { recursive: true });

    const urls: string[] = [];
    for (let i = 0; i < specs.length; i++) {
      const buf = await composeSlide(bgBuf, { width, height, slide: specs[i], theme });
      const filename = `${postId}-carousel-${i}-${Date.now()}.png`;
      await fs.writeFile(path.join(dir, filename), buf);
      urls.push(`/generated/${filename}`);
    }

    await db
      .update(generatedPosts)
      .set({ carouselImages: JSON.stringify(urls), imageUrl: urls[0] })
      .where(eq(generatedPosts.id, postId));

    return NextResponse.json({ images: urls, count: urls.length, style: styleId, styleName: built.styleName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Carousel generation failed";
    console.error("Carousel generation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParse<T>(v: string, fb: T): T {
  try { return JSON.parse(v); } catch { return fb; }
}
