import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { analyzeResume } from "@/lib/resume";

export const maxDuration = 120;

async function getGeminiKey(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini")))
    .limit(1);
  if (!row) return null;
  return decrypt(row.encryptedKey, row.iv, row.authTag);
}

/** GET — return the current user's creator profile (or null). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [profile] = await db
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, session.user.id))
    .limit(1);

  if (!profile) return NextResponse.json({ profile: null });
  return NextResponse.json({
    profile: {
      ...profile,
      data: profile.profileJson ? JSON.parse(profile.profileJson) : null,
    },
  });
}

/** POST — analyze an uploaded resume (PDF file) or pasted text into a profile. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const apiKey = await getGeminiKey(userId);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your Google Gemini API key in Settings first — it's used to analyze the resume." },
      { status: 400 }
    );
  }

  try {
    let pdfBase64: string | undefined;
    let mimeType: string | undefined;
    let text: string | undefined;
    let sourceFilename: string | undefined;
    // One-pager (optional)
    let onePagerPdfBase64: string | undefined;
    let onePagerMimeType: string | undefined;
    let onePagerText: string | undefined;
    let onePagerFilename: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    // Extract a File into pdf-base64 (for PDFs) or utf-8 text (for txt/md).
    async function readFile(file: File): Promise<{ pdf?: string; mime?: string; text?: string } | { error: string }> {
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > 12 * 1024 * 1024) return { error: "File too large (max 12MB)." };
      const mt = file.type || "";
      if (mt === "application/pdf" || /\.pdf$/i.test(file.name)) return { pdf: buf.toString("base64"), mime: "application/pdf" };
      if (mt.startsWith("text/") || /\.(txt|md|rtf|csv)$/i.test(file.name)) return { text: buf.toString("utf-8") };
      // Fall back to treating any other doc as text (best-effort); Gemini also reads many docs as PDF.
      return { pdf: buf.toString("base64"), mime: mt || "application/pdf" };
    }

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pastedText = form.get("text");
      const onePagerFile = form.get("onePager");
      const onePagerPasted = form.get("onePagerText");

      if (file && file instanceof File) {
        sourceFilename = file.name;
        const r = await readFile(file);
        if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
        pdfBase64 = r.pdf; mimeType = r.mime; text = r.text;
      } else if (typeof pastedText === "string" && pastedText.trim().length > 0) {
        text = pastedText;
      }

      if (onePagerFile && onePagerFile instanceof File) {
        onePagerFilename = onePagerFile.name;
        const r = await readFile(onePagerFile);
        if (!("error" in r)) { onePagerPdfBase64 = r.pdf; onePagerMimeType = r.mime; onePagerText = r.text; }
      } else if (typeof onePagerPasted === "string" && onePagerPasted.trim().length > 0) {
        onePagerText = onePagerPasted;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (typeof body.text === "string") text = body.text;
      if (typeof body.onePagerText === "string") onePagerText = body.onePagerText;
    }

    if (!pdfBase64 && (!text || text.trim().length < 30)) {
      return NextResponse.json(
        { error: "Please upload a CV/resume (PDF) or paste at least a short resume text." },
        { status: 400 }
      );
    }

    const data = await analyzeResume({
      apiKey, pdfBase64, mimeType, text,
      onePagerPdfBase64, onePagerMimeType, onePagerText,
    });
    const rawText = text || `[PDF resume: ${sourceFilename || "uploaded"}]`;

    // Upsert (one profile per user)
    const [existing] = await db
      .select({ id: creatorProfiles.id })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);

    const values = {
      userId,
      rawText: rawText.slice(0, 40000),
      sourceFilename: sourceFilename || null,
      onePagerText: (onePagerText || (onePagerFilename ? `[one-pager: ${onePagerFilename}]` : null))?.slice(0, 20000) ?? null,
      onePagerFilename: onePagerFilename || null,
      fullName: data.fullName || null,
      headline: data.headline || null,
      industry: data.industry || null,
      targetAudience: data.targetAudience || null,
      profileJson: JSON.stringify(data),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(creatorProfiles).set(values).where(eq(creatorProfiles.id, existing.id));
    } else {
      await db.insert(creatorProfiles).values({ id: crypto.randomUUID(), ...values });
    }

    return NextResponse.json({ profile: { ...values, data } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume analysis failed";
    console.error("Resume analysis error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — remove the stored profile. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.delete(creatorProfiles).where(eq(creatorProfiles.userId, session.user.id));
  return NextResponse.json({ success: true });
}
