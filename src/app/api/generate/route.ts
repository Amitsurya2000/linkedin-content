import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts, userApiKeys, creatorProfiles } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateLinkedInPosts } from "@/lib/gemini";
import { profileToContext, type CreatorProfileData } from "@/lib/resume";
import { eq, and } from "drizzle-orm";

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
        // Images are also kept on disk: the illustrated deck renders WITH them,
        // so a client-supplied photo can appear in the slides rather than only
        // informing the copy.
        if (mimeType.startsWith("image/")) {
          const dir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(dir, { recursive: true });
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-60);
          const filename = `${Date.now()}-${referenceImages.length}-${safe}`;
          await fs.writeFile(path.join(dir, filename), buf);
          referenceImages.push(`/uploads/${filename}`);
        }
      }
    } else {
      body = await req.json();
    }

    const { topic, postType, postsCount, targetAudience, tonePrefs, slidesCount, customInstructions } = body;

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

    // Get user's Gemini API key
    const [geminiKeyRow] = await db
      .select()
      .from(userApiKeys)
      .where(
        and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini"))
      )
      .limit(1);

    if (!geminiKeyRow) {
      return NextResponse.json(
        { error: "No Gemini API key found. Please add your API key in Settings." },
        { status: 400 }
      );
    }

    const apiKey = decrypt(geminiKeyRow.encryptedKey, geminiKeyRow.iv, geminiKeyRow.authTag);

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
      // Generate posts via Gemini
      const linkedInPosts = await generateLinkedInPosts({
        apiKey,
        topic: topic.trim(),
        postType,
        postsCount: count,
        targetAudience: targetAudience || undefined,
        tonePrefs: tonePrefs || undefined,
        profileContext,
        // Clamped rather than rejected: an out-of-range value should fall back
        // to the benchmark default, not fail the whole generation.
        slidesCount:
          Number(slidesCount) >= 3 && Number(slidesCount) <= 15 ? Number(slidesCount) : undefined,
        referenceDocs: referenceDocs.length ? referenceDocs : undefined,
        customInstructions:
          typeof customInstructions === "string" && customInstructions.trim() ? customInstructions.trim() : undefined,
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
