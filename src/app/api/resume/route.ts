import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creatorProfiles, userApiKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { analyzeResume, type CreatorProfileData } from "@/lib/resume";

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

/** One profile per user — insert or update in place. */
async function upsertProfile(userId: string, values: Record<string, unknown>) {
  const [existing] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId))
    .limit(1);

  if (existing) {
    await db.update(creatorProfiles).set(values).where(eq(creatorProfiles.id, existing.id));
  } else {
    await db.insert(creatorProfiles).values({ id: crypto.randomUUID(), ...values } as never);
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

/**
 * Coerce a hand-filled profile form into the same shape the analyzer returns,
 * so downstream generation reads manual and AI-built profiles identically.
 */
function normalizeProfile(input: Record<string, unknown>): CreatorProfileData {
  const objList = <T>(v: unknown, map: (o: Record<string, unknown>) => T, keep: (o: T) => boolean): T[] =>
    Array.isArray(v)
      ? v.filter((o): o is Record<string, unknown> => !!o && typeof o === "object").map(map).filter(keep)
      : [];

  return {
    fullName: str(input.fullName),
    headline: str(input.headline),
    industry: str(input.industry),
    targetAudience: str(input.targetAudience),
    summary: str(input.summary),
    expertise: strList(input.expertise),
    achievements: objList(
      input.achievements,
      (o) => ({ text: str(o.text), metric: str(o.metric) || undefined }),
      (a) => !!a.text
    ),
    roles: objList(
      input.roles,
      (o) => ({
        title: str(o.title),
        company: str(o.company),
        period: str(o.period) || undefined,
        highlights: strList(o.highlights),
      }),
      (r) => !!(r.title || r.company)
    ),
    signatureStories: strList(input.signatureStories),
    voiceTone: str(input.voiceTone),
    positioning: str(input.positioning),
    contentPillars: objList(
      input.contentPillars,
      (o) => ({ name: str(o.name), description: str(o.description) }),
      (c) => !!c.name
    ),
    postIdeas: strList(input.postIdeas),
    transcriptDetail: strList(input.transcriptDetail),
    goals: str(input.goals),
    objectives: strList(input.objectives),
    contentStrategy: str(input.contentStrategy),
  };
}

/**
 * POST — build the creator profile, one of two ways:
 *  • multipart/JSON with a CV file or resume text → Gemini analyzes it.
 *  • JSON `{ profile: {...} }` → the user filled the sections in by hand;
 *    saved as-is, so no Gemini key is required for this path.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    const form = isMultipart ? await req.formData() : null;
    const body: Record<string, unknown> = isMultipart ? {} : await req.json().catch(() => ({}));

    // ── Manual entry ──
    if (body.profile && typeof body.profile === "object") {
      const data = normalizeProfile(body.profile as Record<string, unknown>);
      if (!data.fullName && !data.headline && !data.summary) {
        return NextResponse.json(
          { error: "Fill in at least your name, headline, or summary." },
          { status: 400 }
        );
      }
      const values = {
        userId,
        rawText: "[profile entered manually]",
        sourceFilename: null,
        onePagerText: null,
        onePagerFilename: null,
        fullName: data.fullName || null,
        headline: data.headline || null,
        industry: data.industry || null,
        targetAudience: data.targetAudience || null,
        profileJson: JSON.stringify(data),
        updatedAt: new Date(),
      };
      await upsertProfile(userId, values);
      return NextResponse.json({ profile: { ...values, data } });
    }

    // ── Analyzed from documents ──
    const apiKey = await getGeminiKey(userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Add your Google Gemini API key in Settings first — it's used to analyze the resume. (Or fill the sections in manually.)" },
        { status: 400 }
      );
    }

    let pdfBase64: string | undefined;
    let mimeType: string | undefined;
    let text: string | undefined;
    let sourceFilename: string | undefined;
    // Second document — experience transcript (or a legacy goals one-pager).
    let onePagerPdfBase64: string | undefined;
    let onePagerMimeType: string | undefined;
    let onePagerText: string | undefined;
    let onePagerFilename: string | undefined;

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

    if (form) {
      const file = form.get("file");
      const pastedText = form.get("text");
      // "transcript" is the current name; "onePager" is accepted so older
      // clients and any saved forms keep working.
      const onePagerFile = form.get("transcript") ?? form.get("onePager");
      const onePagerPasted = form.get("transcriptText") ?? form.get("onePagerText");

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
      if (typeof body.text === "string") text = body.text;
      if (typeof body.transcriptText === "string") onePagerText = body.transcriptText;
      else if (typeof body.onePagerText === "string") onePagerText = body.onePagerText;
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

    await upsertProfile(userId, values);

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
