"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  ImageIcon,
  Layers,
  Zap,
  TrendingUp,
  Calendar,
  Loader2,
} from "lucide-react";

interface RecentUser {
  id: string;
  name: string | null;
  email: string | null;
  creditsUsed: number;
  creditsLimit: number;
  createdAt: string;
}

interface StatsData {
  totalUsers: number;
  totalBatches: number;
  totalPosts: number;
  todayBatches: number;
  weekBatches: number;
  creditsConsumed: number;
  recentUsers: RecentUser[];
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  sub,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  sub?: string;
}) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">
              {title}
            </p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {sub && <p className="text-slate-400 text-xs">{sub}</p>}
          </div>
          <div
            className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
          >
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch {
        toast.error("Failed to load admin stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Failed to load stats. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Welcome back, Administrator. Here&apos;s what&apos;s happening on the platform today.</p>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Active Batches"
          value={stats.totalBatches}
          icon={Layers}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title="Posts Created"
          value={stats.totalPosts}
          icon={ImageIcon}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Posts Today"
          value={stats.todayBatches}
          icon={Calendar}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          sub="batches created today"
        />
        <StatCard
          title="Posts This Week"
          value={stats.weekBatches}
          icon={TrendingUp}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-50"
          sub="batches in last 7 days"
        />
        <StatCard
          title="Total Credits Consumed"
          value={stats.creditsConsumed}
          icon={Zap}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
          sub="across all users"
        />
      </div>

      {/* Recent Users */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            Recent Registrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wider border-b border-slate-100 mb-1">
            <span>User</span>
            <span>Credits Used</span>
            <span>Credits Left</span>
            <span>Joined</span>
          </div>

          <div className="divide-y divide-slate-100">
            {stats.recentUsers.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">
                No users yet
              </p>
            )}
            {stats.recentUsers.map((user) => {
              const initials = (user.name || user.email || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const remaining = Math.max(0, user.creditsLimit - user.creditsUsed);

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 items-center px-4 py-3.5 hover:bg-slate-50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-900 text-sm font-medium truncate">
                        {user.name || "—"}
                      </p>
                      <p className="text-slate-400 text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-slate-900 text-sm font-medium tabular-nums">
                    {user.creditsUsed}
                    <span className="text-slate-400 text-xs ml-1">
                      / {user.creditsLimit}
                    </span>
                  </div>
                  <div className="text-slate-900 text-sm font-medium tabular-nums">
                    {remaining}
                  </div>
                  <div className="text-slate-500 text-sm">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
