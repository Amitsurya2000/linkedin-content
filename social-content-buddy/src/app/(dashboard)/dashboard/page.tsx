"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import {
  PlusSquare,
  ImageIcon,
  Layers,
  Eye,
} from "lucide-react";

interface Batch {
  id: string;
  businessName: string;
  postsCount: number;
  status: string;
  createdAt: string;
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string; text: string }> = {
    completed: { label: "Completed", cls: "bg-emerald-500", text: "text-emerald-600" },
    generating_briefs: { label: "Generating", cls: "bg-amber-500 animate-pulse", text: "text-amber-600" },
    generating_images: { label: "Generating", cls: "bg-amber-500 animate-pulse", text: "text-amber-600" },
    pending: { label: "Draft", cls: "bg-slate-400", text: "text-slate-500" },
    failed: { label: "Failed", cls: "bg-red-500", text: "text-red-600" },
  };
  const { label, cls, text } = config[status] ?? config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
}

export default function DashboardPage() {
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wsLoading) return;
    setLoading(true);
    const wsParam = activeWorkspace ? `&workspace=${activeWorkspace.id}` : "";
    fetch(`/api/batches?limit=5${wsParam}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [activeWorkspace, wsLoading]);

  const greeting = activeWorkspace
    ? activeWorkspace.name
    : "Welcome back";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {greeting}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeWorkspace
              ? `Recent activity for "${activeWorkspace.businessName}".`
              : "Select a workspace to filter your content, or view all batches."}
          </p>
        </div>
        <Link href="/create">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2 rounded-xl font-semibold transition-all cursor-pointer">
            <PlusSquare className="w-4 h-4" />
            New Batch
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && batches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
            <ImageIcon className="w-7 h-7 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {activeWorkspace ? "No batches yet in this workspace" : "Create your first batch"}
            </h3>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">
              Generate high-converting Instagram posts for any business in minutes.
            </p>
          </div>
          <Link href="/create">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2 rounded-xl cursor-pointer">
              <PlusSquare className="w-4 h-4" />
              Get started
            </Button>
          </Link>
        </div>
      )}

      {/* Recent batches */}
      {!loading && batches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Batches</h2>
            <Link href="/history" className="text-sm text-violet-600 hover:text-violet-700 transition-colors">
              View all
            </Link>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="hidden md:grid grid-cols-[2fr_1fr_80px_120px_80px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Batch Name</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Posts</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Action</span>
            </div>

            <div className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1fr_80px_120px_80px] gap-4 items-center px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-900 font-medium text-sm truncate">{batch.businessName}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {batch.postsCount} post{batch.postsCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div><StatusDot status={batch.status} /></div>
                  <div className="text-sm text-slate-900 font-medium">{batch.postsCount}</div>
                  <div className="text-slate-500 text-sm">
                    {new Date(batch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div>
                    <Link href={`/history/${batch.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
