import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts, workspaceMembers, workspaces } from "@/lib/db/schema";
import { generateDesignBriefs } from "@/lib/gemini";
import { getUserApiKey } from "@/lib/crypto";

const schema = z.object({
  businessName: z.string().min(1).max(200),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  targetAudience: z.string().max(500).optional(),
  tonePrefs: z.string().max(300).optional(),
  postsCount: z.number().int().min(1).max(10),
  workspaceId: z.string().uuid().optional(),
  brandColors: z.array(z.string()).optional(),
  brandFonts: z.record(z.string(), z.string()).optional(),
  brandGuidelines: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  productImageUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const {
      businessName,
      websiteUrl,
      targetAudience,
      tonePrefs,
      postsCount,
      workspaceId,
      brandColors,
      brandFonts,
      brandGuidelines,
      logoUrl,
      productImageUrl,
    } = parsed.data;
    const userId = session.user.id;

    // Verify workspace membership if workspaceId is provided
    if (workspaceId) {
      const [isOwner] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
        .limit(1);

      if (!isOwner) {
        const [isMember] = await db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, userId)
            )
          )
          .limit(1);

        if (!isMember) {
          return NextResponse.json(
            { error: "You do not have access to this workspace" },
            { status: 403 }
          );
        }
      }
    }

    // Fetch user's Gemini API key
    const geminiKey = await getUserApiKey(userId, "gemini");
    if (!geminiKey) {
      return NextResponse.json(
        { error: "Please add your Gemini API key in Settings" },
        { status: 400 }
      );
    }

    // Create batch record
    const [batch] = await db
      .insert(postBatches)
      .values({
        userId,
        workspaceId: workspaceId || null,
        businessName,
        websiteUrl: websiteUrl || null,
        targetAudience: targetAudience || null,
        tonePrefs: tonePrefs || null,
        postsCount,
        logoUrl: logoUrl || null,
        productImageUrl: productImageUrl || null,
        status: "generating_briefs",
      })
      .returning({ id: postBatches.id });

    // Generate design briefs with Gemini
    let briefs;
    try {
      briefs = await generateDesignBriefs(
        {
          businessName,
          websiteUrl: websiteUrl || undefined,
          targetAudience: targetAudience || undefined,
          tonePrefs: tonePrefs || undefined,
          postsCount,
          brandColors: brandColors || undefined,
          brandFonts: (brandFonts as Record<string, string>) || undefined,
          brandGuidelines: brandGuidelines || undefined,
          logoUrl: logoUrl || undefined,
          productImageUrl: productImageUrl || undefined,
        },
        geminiKey
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Gemini error:", errMsg);
      await db
        .update(postBatches)
        .set({ status: "failed", errorMessage: errMsg })
        .where(eq(postBatches.id, batch.id));
      return NextResponse.json(
        { error: `Failed to generate design briefs: ${errMsg}` },
        { status: 500 }
      );
    }

    // Save design briefs + create post records
    await db
      .update(postBatches)
      .set({ designBriefs: briefs, status: "generating_images" })
      .where(eq(postBatches.id, batch.id));

    const postValues = briefs.map((brief) => ({
      batchId: batch.id,
      userId,
      hookCategory: brief.hookCategory,
      captionHook: brief.captionHook,
      captionBody: brief.captionBody || null,
      hashtags: brief.hashtags || null,
      designBrief: brief.designBrief,
      whyThisWorks: brief.whyThisWorks,
      captionVariations: brief.captionVariations || null,
      status: "pending" as const,
    }));

    const insertedPosts = await db
      .insert(generatedPosts)
      .values(postValues)
      .returning({
        id: generatedPosts.id,
        hookCategory: generatedPosts.hookCategory,
        captionHook: generatedPosts.captionHook,
        captionBody: generatedPosts.captionBody,
        hashtags: generatedPosts.hashtags,
        whyThisWorks: generatedPosts.whyThisWorks,
        captionVariations: generatedPosts.captionVariations,
      });

    return NextResponse.json({ batchId: batch.id, posts: insertedPosts });
  } catch (err) {
    console.error("Generate briefs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
