"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import { PlusSquare, Layers } from "lucide-react";

interface Batch {
  id: string;
  businessName: string;
  websiteUrl: string | null;
  postsCount: number;
  status: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; dot: string; text: string; bg: string }> = {
    completed: { label: "Completed", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
    generating_briefs: { label: "Generating", dot: "bg-amber-500 animate-pulse", text: "text-amber-700", bg: "bg-amber-50" },
    generating_images: { label: "Generating", dot: "bg-amber-500 animate-pulse", text: "text-amber-700", bg: "bg-amber-50" },
    pending: { label: "Pending", dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-100" },
    failed: { label: "Failed", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
  };
  const { label, dot, text, bg } = config[status] ?? config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${text} ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default function HistoryPage() {
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBatches = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    const wsParam = activeWorkspace ? `&workspace=${activeWorkspace.id}` : "";
    try {
      const r = await fetch(`/api/batches?limit=100${wsParam}`);
      const data = r.ok ? await r.json() : [];
      setBatches(data);
      return data;
    } catch {
      setBatches([]);
      return [];
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (wsLoading) return;
    fetchBatches(true);
  }, [fetchBatches, wsLoading]);

  // Poll every 5s while any batch is still generating
  useEffect(() => {
    const hasGenerating = batches.some(
      (b) => b.status === "generating_briefs" || b.status === "generating_images" || b.status === "pending"
    );

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (hasGenerating) {
      pollRef.current = setInterval(() => fetchBatches(false), 5000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [batches, fetchBatches]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Posts</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeWorkspace
              ? `Posts for "${activeWorkspace.name}".`
              : "All your AI-generated content batches."}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!loading && (
            <>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{batches.length}</span>
              <span className="text-xs text-slate-500 uppercase">Total</span>
            </>
          )}
          <Link href="/create">
            <Button className="bg-red-600 hover:bg-red-700 text-white gap-2 rounded-xl font-semibold cursor-pointer">
              <PlusSquare className="w-4 h-4" />
              New Batch
            </Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && batches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center text-center py-20 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
            <Layers className="w-7 h-7 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">No posts yet</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">Your generated posts will appear here.</p>
          </div>
          <Link href="/create">
            <Button className="bg-red-600 hover:bg-red-700 text-white gap-2 rounded-xl cursor-pointer">
              <PlusSquare className="w-4 h-4" /> Create Posts
            </Button>
          </Link>
        </div>
      )}

      {!loading && batches.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[2fr_80px_120px_120px_60px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Business</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Posts</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date</span>
            <span />
          </div>
          <div className="divide-y divide-slate-100">
            {batches.map((batch) => (
              <div key={batch.id} className="grid grid-cols-1 md:grid-cols-[2fr_80px_120px_120px_60px] gap-4 items-center px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-900 font-medium text-sm truncate">{batch.businessName}</p>
                    {batch.websiteUrl && <p className="text-slate-400 text-xs truncate">{batch.websiteUrl}</p>}
                  </div>
                </div>
                <div className="text-sm text-slate-900 font-medium">
                  {batch.postsCount}<span className="text-slate-400 font-normal ml-1 text-xs">post{batch.postsCount !== 1 ? "s" : ""}</span>
                </div>
                <div><StatusBadge status={batch.status} /></div>
                <div className="text-slate-500 text-sm">
                  {new Date(batch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="flex justify-end">
                  <Link href={`/history/${batch.id}`}>
                    <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg gap-1 cursor-pointer">View</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
