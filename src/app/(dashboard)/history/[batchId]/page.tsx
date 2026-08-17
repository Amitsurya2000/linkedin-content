import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { postBatches, generatedPosts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { BatchPostGrid } from "./batch-post-grid";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { batchId } = await params;

  const [batch] = await db
    .select()
    .from(postBatches)
    .where(and(eq(postBatches.id, batchId), eq(postBatches.userId, session.user.id)))
    .limit(1);

  if (!batch) redirect("/history");

  const posts = await db
    .select()
    .from(generatedPosts)
    .where(eq(generatedPosts.batchId, batchId));

  const completedCount = posts.filter((p) => p.status === "completed").length;
  const failedCount = posts.filter((p) => p.status === "failed").length;

  // Serialize dates for client component
  const serializedPosts = posts.map((p) => ({
    ...p,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-sm text-[#6B5B5A] hover:text-[#6B5B5A] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Posts
        </Link>
        <h1 className="text-3xl font-bold text-[#1A1414] tracking-tight">
          {batch.topic}
        </h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-[#6B5B5A]">
          <span>
            {new Date(batch.createdAt ?? Date.now()).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="text-[#1A1414]">|</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />
            {completedCount} completed
          </span>
          {failedCount > 0 && (
            <>
              <span className="text-[#1A1414]">|</span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="w-3.5 h-3.5" />
                {failedCount} failed
              </span>
            </>
          )}
        </div>
      </div>

      {/* Posts grid — client component for editing */}
      <BatchPostGrid initialPosts={serializedPosts} batchId={batchId} />
    </div>
  );
}
