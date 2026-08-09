import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { isUnsafeUrl } from "@/lib/validation";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  businessName: z.string().min(1).max(200),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  targetAudience: z.string().max(500).optional(),
  tonePrefs: z.string().max(500).optional(),
  brandColors: z.array(z.string()).optional(),
  brandFonts: z.record(z.string(), z.string()).optional(),
  brandGuidelines: z.string().max(2000).optional(),
});

/** GET — List all workspaces for the current user */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, session.user.id))
      .orderBy(desc(workspaces.updatedAt));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Workspaces GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — Create a new workspace */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    if (data.websiteUrl && isUnsafeUrl(data.websiteUrl)) {
      return NextResponse.json({ error: "Invalid or unsafe website URL" }, { status: 400 });
    }

    // Transaction: create workspace + add creator as owner atomically
    const workspace = await db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({
          userId: session.user.id,
          name: data.name,
          businessName: data.businessName,
          websiteUrl: data.websiteUrl || null,
          targetAudience: data.targetAudience || null,
          tonePrefs: data.tonePrefs || null,
          brandColors: data.brandColors || null,
          brandFonts: data.brandFonts || null,
          brandGuidelines: data.brandGuidelines || null,
        })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: ws.id,
        userId: session.user.id,
        role: "owner",
      });

      return ws;
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (err) {
    console.error("Workspace create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
