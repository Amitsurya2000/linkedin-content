import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, generatedPosts } from "@/lib/db/schema";
import { toKoyopoSlides, type RawSlide } from "@/lib/koyopo";
import { renderSwipeDeck } from "@/lib/deck-swipe";
import { renderAttnDeck } from "@/lib/deck-attention";
import { renderEditorialDeck } from "@/lib/deck-render";
import { renderDeckVideo, ffmpegAvailable } from "@/lib/deck-video";

export const maxDuration = 300;

/**
 * GET — encode this post's carousel into an MP4 slide video.
 *
 * Renders the deck fresh rather than reading the saved PNGs, so the video can
 * use a different style from whatever is currently on screen, and so it works
 * on a post whose deck has never been rendered.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ postId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (!(await ffmpegAvailable())) {
      return NextResponse.json(
        { error: "ffmpeg is not installed on this machine, so video encoding is unavailable." },
        { status: 501 }
      );
    }

    const { postId } = await ctx.params;
    const [post] = await db
      .select()
      .from(generatedPosts)
      .where(and(eq(generatedPosts.id, postId), eq(generatedPosts.userId, session.user.id)))
      .limit(1);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const raw: RawSlide[] = post.carouselSlides ? safeParse(post.carouselSlides, []) : [];
    if (!raw.length) {
      return NextResponse.json({ error: "This post has no carousel slides to turn into a video." }, { status: 400 });
    }

    const q = req.nextUrl.searchParams;
    const style = q.get("style") ?? "swipe";
    const seconds = Math.min(6, Math.max(1.5, Number(q.get("seconds") ?? 3)));

    const [profile] = await db
      .select({ fullName: creatorProfiles.fullName })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, session.user.id))
      .limit(1);
    const author = profile?.fullName ?? undefined;

    const slides = toKoyopoSlides(raw);
    const frames =
      style === "attention"
        ? await renderAttnDeck(slides, { canvas: "tall", seed: postId, author })
        : style === "editorial"
          ? await renderEditorialDeck(slides, { canvas: "tall", seed: postId, deckTitle: author })
          : await renderSwipeDeck(slides, { canvas: "tall", seed: postId, author });

    const mp4 = await renderDeckVideo(frames, { secondsPerSlide: seconds, fadeSeconds: 0.5 });

    // Saved alongside the rendered decks so it survives the response and can be
    // re-downloaded without re-encoding.
    const dir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${postId}-${style}-${Date.now()}.mp4`;
    await fs.writeFile(path.join(dir, filename), mp4);

    if (q.get("json") === "1") {
      return NextResponse.json({ url: `/generated/${filename}`, slides: frames.length, seconds });
    }

    return new NextResponse(new Uint8Array(mp4), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="linkedin-carousel-${postId.slice(0, 8)}.mp4"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video encoding failed";
    console.error("Deck video error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeParse<T>(v: string, fb: T): T {
  try { return JSON.parse(v); } catch { return fb; }
}
