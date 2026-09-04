import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts, creatorProfiles } from "@/lib/db/schema";
import { resolveGeminiKey } from "@/lib/api-keys";
import { generateContentAgentPosts } from "@/lib/content-agent";
import { generateCarousels } from "@/lib/carousel-prompt";
import { recentAngles, recentChoices, pruneHistory } from "@/lib/history";
import { profileToContext, type CreatorProfileData } from "@/lib/resume";
import { eq, and } from "drizzle-orm";
import { storePostImages } from "@/lib/store-images";

const VALID_POST_TYPES = ["text", "carousel", "article"] as const;


export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    // Two request shapes. JSON is the plain path; multipart carries optional
    // reference files (a PDF report, a chart screenshot, a photo of a
    // whiteboard) that the post should be built from.
    const contentType = req.headers.get("content-type") || "";
    // Matches what req.json() returned before multipart support; the fields are
    // validated individually below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any> = {};
    const referenceDocs: { data: string; mimeType: string; name?: string }[] = [];
    const referenceImages: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") body[k] = v;
      }
      for (const file of form.getAll("reference")) {
        if (!(file instanceof File)) continue;
        const buf = Buffer.from(await file.arrayBuffer());
        // 12MB matches the resume uploader. Beyond that the inline request body
        // starts failing at the API rather than here, which is a worse error.
        if (buf.length > 12 * 1024 * 1024) {
          return NextResponse.json({ error: `"${file.name}" is over 12MB.` }, { status: 400 });
        }
        const mt = file.type || "";
        const mimeType = mt.startsWith("image/") || mt === "application/pdf"
          ? mt
          : /\.pdf$/i.test(file.name) ? "application/pdf"
          : /\.(png|jpe?g|webp|gif)$/i.test(file.name) ? `image/${file.name.split(".").pop()!.replace("jpg", "jpeg")}`
          // Anything else (docx, txt, md) is handed over as a document; Gemini
          // reads most of them, and a rejected file is a clearer failure than a
          // silently ignored one.
          : "application/pdf";
        referenceDocs.push({ data: buf.toString("base64"), mimeType, name: file.name });
        // Images are stored in the DB (serverless filesystems are read-only)
        // so the illustrated deck can use them as slide art.
        if (mimeType.startsWith("image/")) {
          const [url] = await storePostImages(userId, [buf]);
          referenceImages.push(url);
        }
      }
    } else {
      body = await req.json();
    }

    const { topic, postType, postsCount, targetAudience, tonePrefs, customInstructions } = body;

    // Validate required fields
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    if (!VALID_POST_TYPES.includes(postType)) {
      return NextResponse.json(
        { error: "postType must be one of: text, carousel, article" },
        { status: 400 }
      );
    }

    const count = Number(postsCount);
    if (!count || count < 1 || count > 10) {
      return NextResponse.json(
        { error: "postsCount must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Get Gemini API key — user's own key first, then server fallback
    const apiKey = await resolveGeminiKey(userId);

    if (!apiKey) {
      return NextResponse.json(
        { error: "No Gemini API key found. Please add your API key in Settings." },
        { status: 400 }
      );
    }

    // Load the client's resume-derived Creator Profile (base context for content)
    let profileContext: string | undefined;
    const [profileRow] = await db
      .select({ profileJson: creatorProfiles.profileJson })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);
    if (profileRow?.profileJson) {
      try {
        profileContext = profileToContext(JSON.parse(profileRow.profileJson) as CreatorProfileData);
      } catch {
        profileContext = undefined;
      }
    }

    // Create batch record
    const [batch] = await db
      .insert(postBatches)
      .values({
        id: crypto.randomUUID(),
        userId,
        topic: topic.trim(),
        // The industry column stays for the batches already in the table; the
        // field itself is gone from the form, so new rows leave it null.
        targetAudience: targetAudience || null,
        tonePrefs: tonePrefs || null,
        postType,
        postsCount: count,
        referenceImages: referenceImages.length ? JSON.stringify(referenceImages) : null,
        status: "generating_briefs",
      })
      .returning();

    try {
      // Carousels are generated by the dynamic prompt builder and nothing else
      // — no system prompt, no knowledge files, no per-request directives. See
      // src/lib/carousel-prompt.ts, which owns every rule.
      const linkedInPosts = postType === "carousel"
        ? await generateCarousels({
            apiKey,
            topic: topic.trim(),
            postsCount: count,
            profileContext,
            targetAudience: targetAudience || undefined,
            tonePrefs: tonePrefs || undefined,
            customInstructions:
              typeof customInstructions === "string" && customInstructions.trim()
                ? customInstructions.trim()
                : undefined,
            // The builder draws an angle, hook and theme the history has not
            // used, which is what makes a second render of the same topic come
            // back genuinely different rather than paraphrased.
            history: await recentChoices(userId),
            referenceDocs: referenceDocs.length ? referenceDocs : undefined,
            // Cache-buster that makes every prompt textually unique. Generated
            // by the caller so the builder itself stays pure and testable.
            nonceFor: (i) => (Date.now() + i) % 100000,
          })
        // Text and article posts run on the content agent prompt — see
        // src/lib/prompts/linkedin-content-agent.md. The gemini.ts stack is
        // left intact on disk but is no longer on this path.
        : await generateContentAgentPosts({
            apiKey,
            topic: topic.trim(),
            postsCount: count,
            profileContext,
            targetAudience: targetAudience || undefined,
            tonePrefs: tonePrefs || undefined,
            customInstructions:
              typeof customInstructions === "string" && customInstructions.trim()
                ? customInstructions.trim()
                : undefined,
            // The prompt's variation rule forbids repeating a hook or a core
            // story, which only bites if it can see what came before.
            previousAngles: await recentAngles(userId, topic.trim()),
            referenceDocs: referenceDocs.length ? referenceDocs : undefined,
          });

      // Create generated post records — defensively default every field, since
      // the model can omit fields (e.g. variations) and NOT NULL columns would
      // otherwise reject the insert.
      const createdPosts = [];
      for (const post of linkedInPosts) {
        const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
        const variations = Array.isArray(post.variations) ? post.variations : [];
        const [created] = await db
          .insert(generatedPosts)
          .values({
            id: crypto.randomUUID(),
            batchId: batch.id,
            userId,
            postType,
            hookCategory: post.hookCategory || "Insight",
            hook: post.hook || "",
            body: post.body || "",
            hashtags: JSON.stringify(hashtags),
            cta: post.cta || "",
            whyThisWorks: post.whyThisWorks || "",
            variations: JSON.stringify(variations),
            carouselSlides: post.carouselSlides
              ? JSON.stringify(post.carouselSlides)
              : null,
            // The content agent's web_image_agent + gethos_prompt, kept so the
            // image render follows the brief the copy was written with.
            visualDirective:
              "visualDirective" in post && post.visualDirective
                ? JSON.stringify(post.visualDirective)
                : null,
            status: "completed",
            approvalStatus: "draft",
          })
          .returning();

        createdPosts.push({
          ...created,
          hashtags,
          variations,
          carouselSlides: post.carouselSlides || null,
        });
      }

      // Update batch to completed
      await db
        .update(postBatches)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(postBatches.id, batch.id));

      // Keep only the recent 10 posts in history; prune older batches/posts.
      await pruneHistory(userId);

      return NextResponse.json({
        batchId: batch.id,
        posts: createdPosts,
      });
    } catch (genError) {
      // Update batch to failed
      const errorMessage =
        genError instanceof Error ? genError.message : "Unknown generation error";

      await db
        .update(postBatches)
        .set({
          status: "failed",
          errorMessage,
        })
        .where(eq(postBatches.id, batch.id));

      console.error("Post generation error:", genError);
      return NextResponse.json(
        { error: "Failed to generate posts", details: errorMessage },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Generate route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
