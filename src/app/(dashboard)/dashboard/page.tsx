"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  PenSquare,
  FileText,
  CalendarDays,
  TrendingUp,
  Eye,
  Clock,
  Layers,
} from "lucide-react";
import { AccentIcon, AccentBadge, type Accent } from "@/components/accent-icon";

interface Batch {
  id: string;
  topic: string;
  postType: string;
  postsCount: number;
  status: string;
  createdAt: string;
}

/**
 * Completed and Failed were both red, on a red dot, in a red pill — the two
 * outcomes a status badge exists to tell apart were rendered identically. Draft
 * carried `bg-white/40` for its dot, invisible once the surface went white.
 */
const STATUS: Record<string, { label: string; accent: Accent; pulse?: boolean }> = {
  completed: { label: "Completed", accent: "green" },
  generating: { label: "Generating", accent: "amber", pulse: true },
  failed: { label: "Failed", accent: "red" },
  draft: { label: "Draft", accent: "slate" },
};

function StatusBadge({ status }: { status: string }) {
  const { label, accent, pulse } = STATUS[status] ?? STATUS.draft;
  return <AccentBadge accent={accent} label={label} pulse={pulse} />;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, thisWeek: 0, drafts: 0, scheduled: 0 });

  useEffect(() => {
    setLoading(true);
    fetch("/api/batches?limit=5")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setBatches(data);
        // Compute stats from batches
        const total = data.reduce((sum: number, b: Batch) => sum + b.postsCount, 0);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisWeek = data
          .filter((b: Batch) => new Date(b.createdAt) >= weekAgo)
          .reduce((sum: number, b: Batch) => sum + b.postsCount, 0);
        const drafts = data.filter((b: Batch) => b.status === "draft").length;
        const scheduled = data.filter((b: Batch) => b.status === "scheduled").length;
        setStats({ total, thisWeek, drafts, scheduled });
      })
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, []);

  const userName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1414] tracking-tight">
            Welcome back, {userName}!
          </h1>
          <p className="text-[#6B5B5A] text-sm mt-1">
            Here&apos;s an overview of your LinkedIn content.
          </p>
        </div>
        <Link href="/create">
          <Button className="bg-[#ED383B] hover:bg-[#ED383B]/90 text-white gap-2 rounded-xl font-semibold transition-all cursor-pointer">
            <PenSquare className="w-4 h-4" />
            Create New Post
          </Button>
        </Link>
      </div>

      {/* Four stats that were four shades of the same red. The accent now says
          which is which at a glance: total is the platform, this-week is growth,
          drafts are unfinished, scheduled is time. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} accent="linkedin" label="Total Posts Generated" value={stats.total} loading={loading} />
        <StatCard icon={TrendingUp} accent="green" label="Posts This Week" value={stats.thisWeek} loading={loading} />
        <StatCard icon={Layers} accent="amber" label="Drafts Ready" value={stats.drafts} loading={loading} />
        <StatCard icon={CalendarDays} accent="slate" label="Scheduled" value={stats.scheduled} loading={loading} />
      </div>

      {/* Quick Action Card */}
      <div className="rounded-2xl bg-gradient-to-r from-[#ED383B]/20 to-[#DB272A]/10 border border-[#ED383B]/20 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1A1414] mb-1">Ready to create?</h3>
            <p className="text-[#6B5B5A] text-sm">Generate your next batch of LinkedIn posts in seconds.</p>
          </div>
          <Link href="/create">
            <Button className="bg-[#ED383B] hover:bg-[#ED383B]/90 text-white gap-2 rounded-xl cursor-pointer">
              <PenSquare className="w-4 h-4" />
              Create Post
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white rounded-2xl border border-[#F2DAD8] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && batches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#F2DAD8] bg-white flex flex-col items-center text-center py-16 space-y-4">
          <AccentIcon icon={FileText} accent="linkedin" size="xl" />
          <div>
            <h3 className="text-lg font-semibold text-[#1A1414]">
              No posts yet
            </h3>
            <p className="text-[#6B5B5A] text-sm mt-1 max-w-xs">
              Generate your first batch of LinkedIn posts in seconds with AI.
            </p>
          </div>
          <Link href="/create">
            <Button className="bg-[#ED383B] hover:bg-[#ED383B]/90 text-white gap-2 rounded-xl cursor-pointer">
              <PenSquare className="w-4 h-4" />
              Get started
            </Button>
          </Link>
        </div>
      )}

      {/* Recent Batches */}
      {!loading && batches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1A1414]">Recent Batches</h2>
            <Link href="/history" className="text-sm text-[#C9282A] hover:text-[#8E1B18] transition-colors">
              View all
            </Link>
          </div>

          <div className="rounded-2xl bg-white border border-[#F2DAD8] overflow-hidden">
            <div className="hidden md:grid grid-cols-[2fr_1fr_80px_120px_80px] gap-4 px-5 py-3 border-b border-[#F2DAD8] bg-[#FDF3F2]/50">
              <span className="text-xs font-medium text-[#776462] uppercase tracking-wider">Topic</span>
              <span className="text-xs font-medium text-[#776462] uppercase tracking-wider">Status</span>
              <span className="text-xs font-medium text-[#776462] uppercase tracking-wider">Posts</span>
              <span className="text-xs font-medium text-[#776462] uppercase tracking-wider">Date</span>
              <span className="text-xs font-medium text-[#776462] uppercase tracking-wider">Action</span>
            </div>

            <div className="divide-y divide-[#F2DAD8]">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1fr_80px_120px_80px] gap-4 items-center px-5 py-4 hover:bg-[#FDF3F2] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AccentIcon icon={FileText} accent="linkedin" size="sm" />
                    <div className="min-w-0">
                      <p className="text-[#1A1414] font-medium text-sm truncate">
                        {batch.topic || "Untitled"}
                      </p>
                      <p className="text-[#776462] text-xs mt-0.5 capitalize">
                        {batch.postType || "text"} post
                      </p>
                    </div>
                  </div>
                  <div><StatusBadge status={batch.status} /></div>
                  <div className="text-sm text-[#1A1414] font-medium">{batch.postsCount}</div>
                  <div className="text-[#6B5B5A] text-sm">
                    {new Date(batch.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div>
                    <Link href={`/history/${batch.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#776462] hover:text-[#C9282A] hover:bg-[#ED383B]/[.10] rounded-lg cursor-pointer">
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

function StatCard({
  icon,
  accent,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  accent: Accent;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white border border-[#F2DAD8] p-5">
      <div className="flex items-center gap-3 mb-3">
        <AccentIcon icon={icon} accent={accent} size="md" />
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-[#FAE8E6] rounded-lg animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-[#1A1414]">{value}</p>
      )}
      <p className="text-xs text-[#776462] mt-1">{label}</p>
    </div>
  );
}
