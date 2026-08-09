"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageIcon, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";

interface PostBatch {
  id: string;
  businessName: string;
  websiteUrl: string | null;
  postsCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  userName: string | null;
  userEmail: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; className: string; icon: React.ElementType }
  > = {
    completed: {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    },
    generating_briefs: {
      label: "Generating Briefs",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    generating_images: {
      label: "Generating Images",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    pending: {
      label: "Pending",
      className: "bg-slate-100 text-slate-600 border-slate-200",
      icon: Clock,
    },
    failed: {
      label: "Failed",
      className: "bg-red-50 text-red-600 border-red-200",
      icon: XCircle,
    },
  };

  const cfg = config[status] ?? config.pending;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${cfg.className}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function AdminPostsPage() {
  const [batches, setBatches] = useState<PostBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/admin/posts");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setBatches(data);
      } catch {
        toast.error("Failed to load posts");
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  const completed = batches.filter((b) => b.status === "completed").length;
  const failed = batches.filter((b) => b.status === "failed").length;
  const inProgress = batches.filter(
    (b) =>
      b.status === "generating_briefs" ||
      b.status === "generating_images" ||
      b.status === "pending"
  ).length;

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Posts</h1>
        <p className="text-slate-500 mt-1">
          {batches.length} total batches &middot;{" "}
          <span className="text-emerald-600">{completed} completed</span>
          {failed > 0 && (
            <>
              {" "}&middot;{" "}
              <span className="text-red-500">{failed} failed</span>
            </>
          )}
          {inProgress > 0 && (
            <>
              {" "}&middot;{" "}
              <span className="text-amber-600">{inProgress} in progress</span>
            </>
          )}
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-violet-600" />
            All Post Batches
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table header */}
          <div className="hidden xl:grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_1fr] gap-4 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wider border-b border-slate-100 mb-1">
            <span>Business</span>
            <span>User</span>
            <span>Posts</span>
            <span>Status</span>
            <span>Created</span>
            <span>Completed</span>
          </div>

          <div className="divide-y divide-slate-100">
            {batches.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-10">
                No post batches yet
              </p>
            )}
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="grid grid-cols-1 xl:grid-cols-[2fr_2fr_1fr_1.5fr_1fr_1fr] gap-4 items-center px-4 py-4 hover:bg-slate-50 transition-colors rounded-lg"
              >
                {/* Business */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-900 text-sm font-medium truncate">
                      {batch.businessName}
                    </p>
                    {batch.websiteUrl && (
                      <p className="text-slate-400 text-xs truncate">
                        {batch.websiteUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* User */}
                <div className="min-w-0">
                  <p className="text-slate-900 text-sm truncate">
                    {batch.userName || "—"}
                  </p>
                  <p className="text-slate-400 text-xs truncate">
                    {batch.userEmail || "—"}
                  </p>
                </div>

                {/* Posts count */}
                <div className="flex items-baseline gap-1">
                  <span className="text-slate-900 font-medium text-sm tabular-nums">
                    {batch.postsCount}
                  </span>
                  <span className="text-slate-400 text-xs">
                    post{batch.postsCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={batch.status} />
                </div>

                {/* Created at */}
                <div className="text-slate-500 text-sm">
                  {new Date(batch.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                  <p className="text-slate-400 text-xs">
                    {new Date(batch.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Completed at */}
                <div className="text-slate-500 text-sm">
                  {batch.completedAt ? (
                    <>
                      {new Date(batch.completedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                      <p className="text-slate-400 text-xs">
                        {new Date(batch.completedAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
