"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, TrendingUp, Lightbulb } from "lucide-react";
import { AccentIcon, ACCENTS, type Accent } from "@/components/accent-icon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Insights, MetricRow } from "@/lib/analytics";

const BLANK = {
  label: "", postType: "text", hookCategory: "", postedAt: "",
  impressions: "", reactions: "", comments: "", reposts: "", saves: "", profileViews: "",
};

// The label carries the accent rather than the number: an accent as TEXT wants
// a white ground, and the number should stay ink so the eye reads the value
// before the category.
function Stat({ label, value, hint, accent = "slate" }: { label: string; value: string; hint?: string; accent?: Accent }) {
  return (
    <div className="rounded-xl bg-white border border-[#F2DAD8] p-4">
      <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: ACCENTS[accent].fg }}>{label}</p>
      <p className="text-2xl font-bold text-[#1A1414] mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-[#6B5B5A]">{hint}</p>}
    </div>
  );
}

function BucketTable({ title, rows, unit = "" }: { title: string; rows: Insights["byType"]; unit?: string }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.rate), 0.01);
  return (
    <div className="rounded-2xl bg-white border border-[#F2DAD8] p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[#1A1414]">{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#1A1414] font-medium">{r.key}{unit}</span>
              <span className="text-[#6B5B5A]">
                <span className="text-[#C9282A] font-bold">{r.rate.toFixed(1)}%</span> · {r.posts} post{r.posts === 1 ? "" : "s"} · {r.avgImpressions.toLocaleString()} avg views
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#FDF3F2] overflow-hidden">
              <div className="h-full rounded-full bg-[#ED383B]" style={{ width: `${Math.max(3, (r.rate / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  async function load() {
    const res = await fetch("/api/analytics");
    if (res.ok) {
      const d = await res.json();
      setRows(d.rows);
      setInsights(d.insights);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.label.trim()) { toast.error("Give the post a label"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, postedAt: form.postedAt || undefined }),
      });
      if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error || "Could not save"); return; }
      setForm({ ...BLANK });
      setOpen(false);
      await load();
      toast.success("Logged");
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/analytics?id=${id}`, { method: "DELETE" });
    await load();
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) {
    return <div className="flex items-center gap-3 text-sm text-[#6B5B5A]"><Loader2 className="w-4 h-4 animate-spin text-[#C9282A]" /> Loading…</div>;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1414] tracking-tight">Analytics</h1>
          <p className="text-[#6B5B5A] text-sm mt-1">
            Log what each post actually did. LinkedIn&apos;s API needs a partner-approved app, so these
            numbers are typed in — five fields off the post&apos;s stats page.
          </p>
        </div>
        <Button onClick={() => setOpen(!open)} className="h-10 px-4 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Log a post
        </Button>
      </div>

      {open && (
        <div className="rounded-2xl bg-white border border-[#F2DAD8] p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-[#1A1414]">Label</Label>
              <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Month-end close carousel" className="h-10 rounded-xl border-[#F2DAD8] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A1414]">Format</Label>
              <select value={form.postType} onChange={(e) => set("postType", e.target.value)} className="w-full h-10 px-3 rounded-xl bg-white border border-[#F2DAD8] text-sm text-[#1A1414] outline-none">
                {["text", "carousel", "article", "poll", "video", "image"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A1414]">Posted on</Label>
              <Input type="date" value={form.postedAt} onChange={(e) => set("postedAt", e.target.value)} className="h-10 rounded-xl border-[#F2DAD8] text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-[#1A1414]">Hook archetype (optional)</Label>
              <Input value={form.hookCategory} onChange={(e) => set("hookCategory", e.target.value)} placeholder="A. Bold/counterintuitive claim" className="h-10 rounded-xl border-[#F2DAD8] text-sm" />
            </div>
            {([["impressions", "Impressions"], ["reactions", "Reactions"], ["comments", "Comments"], ["reposts", "Reposts"], ["saves", "Saves"], ["profileViews", "Profile views"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1414]">{l}</Label>
                <Input inputMode="numeric" value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" className="h-10 rounded-xl border-[#F2DAD8] text-sm" />
              </div>
            ))}
          </div>
          <Button onClick={save} disabled={saving} className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#F2DAD8] bg-[#FDF3F2] p-8 text-center">
          <div className="flex justify-center mb-3"><AccentIcon icon={TrendingUp} accent="green" size="xl" /></div>
          <p className="text-sm text-[#1A1414] font-medium">Nothing logged yet</p>
          <p className="text-xs text-[#6B5B5A] mt-1">Log 5–10 posts and this page starts telling you which format, hook and day actually work for you.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Posts" value={String(insights?.totals.posts ?? 0)} accent="linkedin" />
            <Stat label="Impressions" value={(insights?.totals.impressions ?? 0).toLocaleString()} accent="slate" />
            <Stat label="Engagement" value={`${(insights?.totals.rate ?? 0).toFixed(1)}%`} hint="per 100 impressions" accent="green" />
            <Stat label="Profile views" value={(insights?.totals.profileViews ?? 0).toLocaleString()} accent="amber" />
          </div>

          {insights?.findings.length ? (
            <div className="rounded-2xl bg-[#FDF3F2] border border-[#F2DAD8] p-5 space-y-2">
              <h3 className="text-sm font-semibold text-[#1A1414] flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-[#B45309]" /> What the numbers say</h3>
              <ul className="space-y-1.5">
                {insights.findings.map((f, i) => <li key={i} className="text-xs text-[#1A1414]">• {f}</li>)}
              </ul>
            </div>
          ) : null}

          <BucketTable title="By format" rows={insights?.byType ?? []} />
          <BucketTable title="By hook archetype" rows={insights?.byHook ?? []} />
          <BucketTable title="By posting day" rows={insights?.byDay ?? []} />

          <div className="rounded-2xl bg-white border border-[#F2DAD8] overflow-hidden">
            <h3 className="text-sm font-semibold text-[#1A1414] p-4 pb-2">Logged posts</h3>
            <div className="divide-y divide-[#F2DAD8]">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm text-[#1A1414] font-medium truncate">{r.label}</p>
                    <p className="text-xs text-[#6B5B5A]">
                      {r.postType} · {(r.impressions ?? 0).toLocaleString()} views · {((r.reactions ?? 0) + (r.comments ?? 0) + (r.reposts ?? 0) + (r.saves ?? 0)).toLocaleString()} engagements
                    </p>
                  </div>
                  <button onClick={() => remove(r.id)} className="p-2 rounded-lg text-[#6B5B5A] hover:text-[#C9282A] hover:bg-[#ED383B]/[.10] shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
