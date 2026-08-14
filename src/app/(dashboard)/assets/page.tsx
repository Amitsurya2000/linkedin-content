"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Copy, Check, Download, Mail, MessageSquare, Send,
  Building2, Star, Video, UserCircle2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Kind = "newsletter" | "comments" | "dms" | "companyPage" | "featured" | "videoScript" | "photo";

const TABS: { k: Kind; label: string; icon: React.ElementType; blurb: string }[] = [
  { k: "newsletter", label: "Newsletter", icon: Mail, blurb: "A full issue plus a downloadable cover." },
  { k: "comments", label: "Comments", icon: MessageSquare, blurb: "Comments that get you noticed on other people's posts." },
  { k: "dms", label: "DMs & intros", icon: Send, blurb: "Connection notes and follow-ups, researched not sprayed." },
  { k: "featured", label: "Featured", icon: Star, blurb: "The 4 items pinned at the top of your profile, with covers." },
  { k: "companyPage", label: "Company page", icon: Building2, blurb: "Tagline, About and a week of page posts." },
  { k: "videoScript", label: "Video script", icon: Video, blurb: "A 45–70s talking-head script with a shot list." },
  { k: "photo", label: "Profile photo", icon: UserCircle2, blurb: "Turn a headshot into a proper profile photo." },
];

const THEMES = [
  { k: "navy", label: "Navy", dot: "#0B1F3A" },
  { k: "graphite", label: "Graphite", dot: "#16181D" },
  { k: "forest", label: "Forest", dot: "#10241C" },
  { k: "slate", label: "Slate", dot: "#101B26" },
  { k: "ivory", label: "Ivory", dot: "#F4F1EA" },
  { k: "paper", label: "Paper", dot: "#F7F4EF" },
] as const;

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
          toast.success("Copied");
        } catch { toast.error("Could not copy"); }
      }}
      className="flex items-center gap-1.5 text-xs font-medium text-[#ED383B] px-2.5 py-1.5 rounded-lg border border-[#ED383B]/40 hover:bg-[#ED383B]/10 shrink-0"
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-[#F5C5C7] p-4 space-y-2">{children}</div>;
}

export default function AssetsPage() {
  const [tab, setTab] = useState<Kind>("newsletter");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>("navy");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Record<string, any>>({});

  // Profile photo tab
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoStyle, setPhotoStyle] = useState("ring");
  const [photoOut, setPhotoOut] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const current = data[tab];

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, brief: brief.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Could not generate"); return; }
      setData((prev) => ({ ...prev, [tab]: d.data }));
      toast.success("Done");
    } catch { setError("Something went wrong"); }
    finally { setBusy(false); }
  }

  async function makePhoto() {
    if (!photoFile) { toast.error("Choose a photo first"); return; }
    setPhotoBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("theme", theme);
      fd.append("style", photoStyle);
      const res = await fetch("/api/assets/photo", { method: "POST", body: fd });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Could not process that photo");
        return;
      }
      const blob = await res.blob();
      // Revoke the previous object URL so repeated tries don't leak blobs.
      setPhotoOut((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
      toast.success("Profile photo ready");
    } catch { setError("Something went wrong"); }
    finally { setPhotoBusy(false); }
  }

  const coverUrl = (headline: string, kicker?: string, sub?: string, size = "featured", dl = false) =>
    `/api/assets/cover?headline=${encodeURIComponent(headline)}` +
    (kicker ? `&kicker=${encodeURIComponent(kicker)}` : "") +
    (sub ? `&sub=${encodeURIComponent(sub)}` : "") +
    `&size=${size}&theme=${theme}${dl ? "&download=1" : "&scale=1"}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight">Assets</h1>
        <p className="text-[#6B6B6B] text-sm mt-1">
          Everything on LinkedIn that is not a post. All of it runs on your Gemini key — no other service.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => { setTab(k); setError(null); }}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold border transition-colors ${
              tab === k ? "bg-[#ED383B] text-white border-[#ED383B]" : "bg-white text-[#6B6B6B] border-[#F5C5C7] hover:border-[#ED383B]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[#6B6B6B] -mt-3">{TABS.find((t) => t.k === tab)?.blurb}</p>

      {/* Theme picker — shared by every rendered image on this page. */}
      {(tab === "newsletter" || tab === "featured" || tab === "photo") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] font-semibold">Colour</span>
          {THEMES.map((t) => (
            <button
              key={t.k}
              onClick={() => setTheme(t.k)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                theme === t.k ? "border-[#ED383B] text-[#ED383B] bg-[#ED383B]/10" : "border-[#F5C5C7] text-[#6B6B6B]"
              }`}
            >
              <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: t.dot }} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Profile photo ── */}
      {tab === "photo" ? (
        <div className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-4">
          <div
            onClick={() => photoRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setPhotoFile(f); }}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer ${photoFile ? "border-[#ED383B]/60 bg-[#ED383B]/5" : "border-[#F5C5C7] hover:border-[#ED383B]/50"}`}
          >
            <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoFile(f); }} />
            {photoFile ? <Check className="w-6 h-6 text-[#ED383B] mx-auto mb-1.5" /> : <Upload className="w-6 h-6 text-[#6B6B6B] mx-auto mb-1.5" />}
            <p className="text-xs text-[#1A1A1A] font-semibold">{photoFile ? photoFile.name : "Drop a headshot, or click to choose"}</p>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">JPG or PNG. Shoulders-up works best. Your photo is processed and returned — never stored.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] font-semibold">Style</span>
            {[["ring", "Accent ring"], ["halo", "Halo"], ["duotone", "Duotone"], ["plain", "Plain"]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPhotoStyle(k)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${photoStyle === k ? "border-[#ED383B] text-[#ED383B] bg-[#ED383B]/10" : "border-[#F5C5C7] text-[#6B6B6B]"}`}
              >{l}</button>
            ))}
          </div>

          <Button onClick={makePhoto} disabled={photoBusy || !photoFile} className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 disabled:opacity-50">
            {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Make my profile photo
          </Button>

          {photoOut && (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoOut} alt="Your profile photo" className="w-40 h-40 rounded-full border border-[#F5C5C7]" />
              <div className="space-y-2">
                <p className="text-xs text-[#6B6B6B]">800 × 800. LinkedIn crops to a circle — this is composed for it.</p>
                <a href={photoOut} download="linkedin-profile-photo.png" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#ED383B] text-white text-xs font-semibold">
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </a>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <>
          {/* ── Generate ── */}
          <div className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#1A1A1A]">Brief (optional)</Label>
              <Input
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. aimed at FP&A managers at fintechs, about closing the books faster"
                className="bg-white border-[#F5C5C7] text-[#1A1A1A] rounded-xl h-10 text-sm"
              />
            </div>
            <Button onClick={generate} disabled={busy} className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? "Writing…" : current ? "Regenerate" : "Generate"}
            </Button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {/* ── Newsletter ── */}
          {tab === "newsletter" && current && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[#1A1A1A] font-semibold">{current.title}</h2>
                    <p className="text-xs text-[#6B6B6B]">{current.subtitle}</p>
                  </div>
                  <a href={coverUrl(current.coverHeadline || current.title, "NEWSLETTER", current.subtitle, "newsletter", true)}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#ED383B] text-white text-xs font-semibold shrink-0">
                    <Download className="w-3.5 h-3.5" /> Cover
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl(current.coverHeadline || current.title, "NEWSLETTER", current.subtitle, "newsletter")}
                  alt="Newsletter cover" className="w-full rounded-xl border border-[#F5C5C7]" />
              </div>

              <div className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Issue</h3>
                  <CopyBtn
                    label="Copy issue"
                    text={[current.hook, ...(current.sections ?? []).map((s: { heading: string; body: string }) => `${s.heading}\n\n${s.body}`), current.takeaway, current.cta].join("\n\n")}
                  />
                </div>
                <p className="text-sm text-[#1A1A1A] leading-relaxed">{current.hook}</p>
                {(current.sections ?? []).map((s: { heading: string; body: string }, i: number) => (
                  <div key={i} className="space-y-1">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{s.heading}</p>
                    <p className="text-sm text-[#6B6B6B] leading-relaxed">{s.body}</p>
                  </div>
                ))}
                <p className="text-sm font-semibold text-[#1A1A1A]">{current.takeaway}</p>
                <p className="text-sm text-[#6B6B6B]">{current.cta}</p>
                {current.subjectLines?.length > 0 && (
                  <div className="pt-2 border-t border-[#F5C5C7]">
                    <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B] font-bold mb-1.5">Subject lines</p>
                    {current.subjectLines.map((s: string, i: number) => (
                      <p key={i} className="text-xs text-[#1A1A1A]">• {s}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Comments ── */}
          {tab === "comments" && current?.comments && (
            <div className="space-y-3">
              {current.comments.map((c: { scenario: string; postType: string; text: string; why: string }, i: number) => (
                <Card key={i}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-[#ED383B] font-bold">{c.scenario}</p>
                      <p className="text-sm text-[#1A1A1A] mt-1">{c.text}</p>
                    </div>
                    <CopyBtn text={c.text} />
                  </div>
                  <p className="text-xs text-[#6B6B6B]">{c.why}</p>
                </Card>
              ))}
            </div>
          )}

          {/* ── DMs ── */}
          {tab === "dms" && current?.sequences && (
            <div className="space-y-4">
              {current.sequences.map((s: { name: string; target: string; research: string; steps: { stage: string; timing: string; text: string; charCount?: number }[] }, i: number) => (
                <div key={i} className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">{s.name}</h3>
                    <p className="text-xs text-[#6B6B6B]">{s.target}</p>
                    <p className="text-xs text-[#6B6B6B] mt-1"><span className="font-medium text-[#1A1A1A]">Research first:</span> {s.research}</p>
                  </div>
                  {(s.steps ?? []).map((st, j) => {
                    const over = st.stage?.toLowerCase().includes("connect") && (st.charCount ?? 0) > 300;
                    return (
                      <div key={j} className="rounded-xl bg-[#FCEBEC] border border-[#F5C5C7] p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B] font-bold">{st.stage} · {st.timing}</p>
                          <CopyBtn text={st.text} />
                        </div>
                        <p className="text-sm text-[#1A1A1A]">{st.text}</p>
                        {st.charCount !== undefined && (
                          <p className={`text-[10px] ${over ? "text-red-500 font-semibold" : "text-[#6B6B6B]"}`}>
                            {st.charCount} characters{over ? " — over LinkedIn's 300 limit for connection notes" : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ── Featured ── */}
          {tab === "featured" && current?.items && (
            <div className="space-y-4">
              {current.items.map((it: { title: string; subtitle: string; kind: string; why: string; coverHeadline: string; coverKicker: string }, i: number) => (
                <div key={i} className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#ED383B] font-bold">{it.kind}</p>
                      <h3 className="text-sm font-semibold text-[#1A1A1A]">{it.title}</h3>
                      <p className="text-xs text-[#6B6B6B]">{it.subtitle}</p>
                    </div>
                    <a href={coverUrl(it.coverHeadline, it.coverKicker, it.subtitle, "featured", true)}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#ED383B] text-white text-xs font-semibold shrink-0">
                      <Download className="w-3.5 h-3.5" /> Cover
                    </a>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl(it.coverHeadline, it.coverKicker, it.subtitle)} alt={it.title} className="w-full rounded-xl border border-[#F5C5C7]" />
                  <p className="text-xs text-[#6B6B6B]"><span className="font-medium text-[#1A1A1A]">Proves:</span> {it.why}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Company page ── */}
          {tab === "companyPage" && current && (
            <div className="space-y-4">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B] font-bold">Tagline</p>
                    <p className="text-sm text-[#1A1A1A] font-medium">{current.tagline}</p>
                  </div>
                  <CopyBtn text={current.tagline} />
                </div>
              </Card>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B] font-bold">About</p>
                  <CopyBtn text={current.about} />
                </div>
                <p className="text-sm text-[#1A1A1A] whitespace-pre-line leading-relaxed">{current.about}</p>
                <p className="text-xs text-[#6B6B6B]">{String(current.about ?? "").length} characters</p>
              </Card>
              {current.specialties?.length > 0 && (
                <Card>
                  <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B] font-bold">Specialties</p>
                  <div className="flex flex-wrap gap-1.5">
                    {current.specialties.map((s: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-[#FCEBEC] border border-[#F5C5C7] text-[#1A1A1A]">{s}</span>
                    ))}
                  </div>
                </Card>
              )}
              {(current.posts ?? []).map((p: { day: string; angle: string; text: string }, i: number) => (
                <Card key={i}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#ED383B] font-bold">{p.day}</p>
                      <p className="text-xs text-[#6B6B6B]">{p.angle}</p>
                    </div>
                    <CopyBtn text={p.text} />
                  </div>
                  <p className="text-sm text-[#1A1A1A] whitespace-pre-line">{p.text}</p>
                </Card>
              ))}
            </div>
          )}

          {/* ── Video script ── */}
          {tab === "videoScript" && current && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-[#F5C5C7] p-5 space-y-2">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">{current.title}</h3>
                <p className="text-sm text-[#ED383B] font-semibold">{current.hookLine}</p>
                <p className="text-xs text-[#6B6B6B]">First 3 seconds. Spoken and on screen — LinkedIn video plays muted.</p>
              </div>
              <div className="rounded-2xl bg-white border border-[#F5C5C7] overflow-hidden">
                <div className="flex items-center justify-between p-4 pb-2">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">Script</h3>
                  <CopyBtn label="Copy script" text={(current.script ?? []).map((b: { t: string; spoken: string }) => `[${b.t}] ${b.spoken}`).join("\n")} />
                </div>
                <div className="divide-y divide-[#F5C5C7]">
                  {(current.script ?? []).map((b: { t: string; spoken: string; onScreen: string; shot: string }, i: number) => (
                    <div key={i} className="p-4 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-[#ED383B] font-bold">{b.t}</p>
                      <p className="text-sm text-[#1A1A1A]">{b.spoken}</p>
                      <p className="text-xs text-[#6B6B6B]"><span className="font-medium">On screen:</span> {b.onScreen}</p>
                      <p className="text-xs text-[#6B6B6B]"><span className="font-medium">Shot:</span> {b.shot}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B] font-bold">Caption</p>
                  <CopyBtn text={`${current.caption}\n\n${(current.hashtags ?? []).map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}`} />
                </div>
                <p className="text-sm text-[#1A1A1A] whitespace-pre-line">{current.caption}</p>
                <p className="text-xs text-[#ED383B]">{(current.hashtags ?? []).map((h: string) => `#${h.replace(/^#/, "")}`).join("  ")}</p>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
