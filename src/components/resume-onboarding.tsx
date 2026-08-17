"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Sparkles, CheckCircle2, Trash2, Lightbulb, ChevronDown, ChevronUp, Plus, X, PencilLine, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CreatorProfile {
  fullName?: string;
  headline?: string;
  industry?: string;
  targetAudience?: string;
  summary?: string;
  positioning?: string;
  voiceTone?: string;
  expertise?: string[];
  achievements?: { text: string; metric?: string }[];
  roles?: { title: string; company: string; period?: string; highlights: string[] }[];
  signatureStories?: string[];
  contentPillars?: { name: string; description: string }[];
  postIdeas?: string[];
  transcriptDetail?: string[];
  goals?: string;
  objectives?: string[];
  contentStrategy?: string;
}

// ── Manual entry form model ──────────────────────────────────────────────────
// List-shaped sections are edited as one-item-per-line text so the form stays
// usable; they're split back into arrays on submit.
interface ManualForm {
  fullName: string;
  headline: string;
  industry: string;
  targetAudience: string;
  summary: string;
  positioning: string;
  voiceTone: string;
  expertise: string;
  achievements: { text: string; metric: string }[];
  roles: { title: string; company: string; period: string; highlights: string }[];
  signatureStories: string;
  contentPillars: { name: string; description: string }[];
  postIdeas: string;
  transcriptDetail: string;
  goals: string;
  objectives: string;
  contentStrategy: string;
}

const EMPTY_FORM: ManualForm = {
  fullName: "",
  headline: "",
  industry: "",
  targetAudience: "",
  summary: "",
  positioning: "",
  voiceTone: "",
  expertise: "",
  achievements: [{ text: "", metric: "" }],
  roles: [{ title: "", company: "", period: "", highlights: "" }],
  signatureStories: "",
  contentPillars: [{ name: "", description: "" }],
  postIdeas: "",
  transcriptDetail: "",
  goals: "",
  objectives: "",
  contentStrategy: "",
};

const lines = (s: string): string[] =>
  s.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

function formToProfile(f: ManualForm): CreatorProfile {
  return {
    fullName: f.fullName.trim(),
    headline: f.headline.trim(),
    industry: f.industry.trim(),
    targetAudience: f.targetAudience.trim(),
    summary: f.summary.trim(),
    positioning: f.positioning.trim(),
    voiceTone: f.voiceTone.trim(),
    expertise: lines(f.expertise.replace(/,/g, "\n")),
    achievements: f.achievements
      .filter((a) => a.text.trim())
      .map((a) => ({ text: a.text.trim(), metric: a.metric.trim() })),
    roles: f.roles
      .filter((r) => r.title.trim() || r.company.trim())
      .map((r) => ({
        title: r.title.trim(),
        company: r.company.trim(),
        period: r.period.trim(),
        highlights: lines(r.highlights),
      })),
    signatureStories: lines(f.signatureStories),
    contentPillars: f.contentPillars
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(), description: c.description.trim() })),
    postIdeas: lines(f.postIdeas),
    transcriptDetail: lines(f.transcriptDetail),
    goals: f.goals.trim(),
    objectives: lines(f.objectives),
    contentStrategy: f.contentStrategy.trim(),
  };
}

function profileToForm(p: CreatorProfile): ManualForm {
  return {
    fullName: p.fullName || "",
    headline: p.headline || "",
    industry: p.industry || "",
    targetAudience: p.targetAudience || "",
    summary: p.summary || "",
    positioning: p.positioning || "",
    voiceTone: p.voiceTone || "",
    expertise: (p.expertise || []).join("\n"),
    achievements: (p.achievements || []).length
      ? p.achievements!.map((a) => ({ text: a.text || "", metric: a.metric || "" }))
      : [{ text: "", metric: "" }],
    roles: (p.roles || []).length
      ? p.roles!.map((r) => ({
          title: r.title || "",
          company: r.company || "",
          period: r.period || "",
          highlights: (r.highlights || []).join("\n"),
        }))
      : [{ title: "", company: "", period: "", highlights: "" }],
    signatureStories: (p.signatureStories || []).join("\n"),
    contentPillars: (p.contentPillars || []).length
      ? p.contentPillars!.map((c) => ({ name: c.name || "", description: c.description || "" }))
      : [{ name: "", description: "" }],
    postIdeas: (p.postIdeas || []).join("\n"),
    transcriptDetail: (p.transcriptDetail || []).join("\n"),
    goals: p.goals || "",
    objectives: (p.objectives || []).join("\n"),
    contentStrategy: p.contentStrategy || "",
  };
}

// ── Small form primitives (kept local; they only exist for this form) ────────
const inputCls =
  "w-full h-10 rounded-xl bg-[#FDF3F2] border border-[#F2DAD8] px-3 text-sm text-[#1A1414] placeholder:text-[#6B5B5A] focus:outline-none focus:border-[#ED383B]/60";
const areaCls =
  "w-full rounded-xl bg-[#FDF3F2] border border-[#F2DAD8] px-3 py-2 text-sm text-[#1A1414] placeholder:text-[#6B5B5A] focus:outline-none focus:border-[#ED383B]/60 resize-y";

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[#1A1414]">
        {label}
        {hint && <span className="ml-1.5 font-normal text-[11px] text-[#6B5B5A]">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#F2DAD8] p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-[#1A1414]">{title}</h4>
        <p className="text-[11px] text-[#6B5B5A] mt-0.5">{blurb}</p>
      </div>
      {children}
    </div>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium text-[#ED383B] hover:underline"
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function RemoveRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1 rounded-md text-[#6B5B5A] hover:text-[#ED383B] hover:bg-[#ED383B]/[.10] shrink-0"
      title="Remove"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );
}

export function ResumeOnboarding({
  onProfileReady,
  onUseIdea,
}: {
  onProfileReady?: (p: CreatorProfile | null) => void;
  onUseIdea?: (idea: string) => void;
}) {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true); // initial fetch
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Always land on the entry screen — a previously saved profile is offered as
  // an option ("View saved"), never as the default state of the page.
  const [view, setView] = useState<"entry" | "saved">("entry");
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [removing, setRemoving] = useState(false);

  // Upload tab
  const fileRef = useRef<HTMLInputElement>(null);
  const oneRef = useRef<HTMLInputElement>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [onePagerFile, setOnePagerFile] = useState<File | null>(null);
  const [onePagerText, setOnePagerText] = useState("");
  const [resumeText, setResumeText] = useState("");

  // Manual tab
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM);
  const set = <K extends keyof ManualForm>(k: K, v: ManualForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/resume");
        if (res.ok) {
          const data = await res.json();
          const p = data.profile?.data ?? null;
          setProfile(p);
          onProfileReady?.(p);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitDocuments() {
    const hasText = resumeText.trim().length >= 30;
    if (!cvFile && !hasText) {
      toast.error("Add your CV / resume, or paste your background as text");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      if (cvFile) fd.append("file", cvFile);
      else fd.append("text", resumeText.trim());
      if (onePagerFile) fd.append("transcript", onePagerFile);
      else if (onePagerText.trim()) fd.append("transcriptText", onePagerText.trim());
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
        return;
      }
      setProfile(data.profile.data);
      onProfileReady?.(data.profile.data);
      setCvFile(null);
      setOnePagerFile(null);
      setOnePagerText("");
      setResumeText("");
      setView("saved");
      toast.success("Profile analyzed — content is now personalized to you.");
    } catch {
      setError("Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitManual() {
    const payload = formToProfile(form);
    if (!payload.fullName && !payload.headline && !payload.summary) {
      toast.error("Fill in at least your name, headline, or summary");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save your profile");
        return;
      }
      setProfile(data.profile.data);
      onProfileReady?.(data.profile.data);
      setView("saved");
      toast.success("Profile saved — content is now personalized to you.");
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function removeProfile() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/resume", { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Could not remove your resume");
        return;
      }
      setProfile(null);
      setView("entry");
      setTab("upload");
      setForm(EMPTY_FORM);
      onProfileReady?.(null);
      toast.success("Your saved resume was removed — upload a fresh one anytime.");
    } catch {
      setError("Something went wrong");
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-[#F2DAD8] p-5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-[#ED383B] animate-spin" />
        <span className="text-sm text-[#6B5B5A]">Checking your profile…</span>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-[#ED383B]/15 to-[#7F1D1F]/10 border border-[#ED383B]/30 p-6 text-center">
        <Loader2 className="w-8 h-8 text-[#ED383B] animate-spin mx-auto mb-3" />
        <h3 className="text-[#1A1414] font-semibold">Analyzing your resume…</h3>
        <p className="text-[#6B5B5A] text-sm mt-1">Extracting your experience, achievements, voice, and positioning.</p>
      </div>
    );
  }

  // ── Saved profile view (opt-in: reached after a save, or via "View saved") ──
  if (profile && view === "saved") {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-[#ED383B]/12 to-[#7F1D1F]/8 border border-[#ED383B]/25 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ED383B]/[.18] border border-[#ED383B]/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#ED383B]" />
              </div>
              <div>
                <p className="text-[#1A1414] font-semibold text-sm">
                  Personalizing from {profile.fullName || "your"} resume
                </p>
                {profile.headline && (
                  <p className="text-xs text-[#6B5B5A] mt-0.5 line-clamp-2">{profile.headline}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-[#6B5B5A] hover:text-[#1A1414] hover:bg-[#FDF3F2]"
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setView("entry"); setTab("upload"); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#ED383B] border border-[#ED383B]/40 hover:bg-[#ED383B]/[.10]"
              >
                <Upload className="w-3.5 h-3.5" />
                Start over
              </button>
              <button
                onClick={removeProfile}
                disabled={removing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6B5B5A] border border-[#F2DAD8] hover:text-[#ED383B] hover:border-[#ED383B]/50/40 hover:bg-[#ED383B]/[.10] disabled:opacity-50 disabled:pointer-events-none"
                title="Delete your saved resume and start fresh"
              >
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 space-y-4">
              {profile.expertise && profile.expertise.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#6B5B5A] font-medium mb-1.5">Expertise</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.expertise.slice(0, 8).map((e, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-[#FDF3F2] border border-[#F2DAD8] text-[#1A1414]">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.postIdeas && profile.postIdeas.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#6B5B5A] font-medium mb-1.5 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-[#ED383B]" />
                    Post ideas from your experience — click to use
                  </p>
                  <div className="space-y-1.5">
                    {profile.postIdeas.slice(0, 8).map((idea, i) => (
                      <button
                        key={i}
                        onClick={() => { onUseIdea?.(idea); toast.success("Idea loaded into the topic field"); }}
                        className="w-full text-left text-xs text-[#1A1414] bg-[#FDF3F2] border border-[#F2DAD8] rounded-lg px-3 py-2 hover:border-[#ED383B]/50/40 hover:text-[#1A1414] transition-colors"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Entry view — the default on every visit ──
  return (
    <div className="rounded-2xl bg-white border border-[#F2DAD8] overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#ED383B]/[.18] border border-[#ED383B]/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#ED383B]" />
          </div>
          <div>
            <h3 className="text-[#1A1414] font-semibold">Create your profile</h3>
            <p className="text-xs text-[#6B5B5A]">
              Upload your CV to have it analyzed, or fill in every section yourself.
            </p>
          </div>
        </div>

        {/* An earlier profile is still on file — offered, never assumed. */}
        {profile && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FDF3F2] border border-[#F2DAD8] px-3 py-2.5 mb-4">
            <FileText className="w-4 h-4 text-[#6B5B5A] shrink-0" />
            <p className="text-xs text-[#6B5B5A] flex-1 min-w-[140px]">
              You have a saved profile{profile.fullName ? ` for ${profile.fullName}` : ""}. Uploading again replaces it.
            </p>
            <button
              onClick={() => setView("saved")}
              className="text-xs font-medium text-[#ED383B] px-2.5 py-1 rounded-lg border border-[#ED383B]/40 hover:bg-[#ED383B]/[.10]"
            >
              View saved
            </button>
            <button
              onClick={removeProfile}
              disabled={removing}
              className="text-xs font-medium text-[#6B5B5A] px-2.5 py-1 rounded-lg border border-[#F2DAD8] hover:text-[#ED383B] hover:border-[#ED383B]/50/40 disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#FDF3F2] border border-[#F2DAD8] mb-4">
          {([
            { k: "upload" as const, label: "Upload resume", icon: Upload },
            { k: "manual" as const, label: "Fill in manually", icon: PencilLine },
          ]).map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors ${
                tab === k ? "bg-[#ED383B] text-white" : "text-[#6B5B5A] hover:text-[#1A1414]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Upload tab ── */}
        {tab === "upload" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CV slot */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setCvFile(f); }}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${cvFile ? "border-[#ED383B]/60 bg-[#ED383B]/5" : "border-[#F2DAD8] hover:border-[#ED383B]/50/50"}`}
              >
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.doc,.docx,.rtf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setCvFile(f); }} />
                {cvFile ? <CheckCircle2 className="w-6 h-6 text-[#ED383B] mx-auto mb-1.5" /> : <FileText className="w-6 h-6 text-[#6B5B5A] mx-auto mb-1.5" />}
                <p className="text-xs text-[#1A1414] font-semibold">CV / Resume <span className="text-[#ED383B]">*</span></p>
                <p className="text-[11px] text-[#6B5B5A] mt-0.5 truncate">{cvFile ? cvFile.name : "Any format · click to upload"}</p>
              </div>

              {/* Experience transcript slot */}
              <div
                onClick={() => oneRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setOnePagerFile(f); }}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${onePagerFile ? "border-[#ED383B]/60 bg-[#ED383B]/5" : "border-[#F2DAD8] hover:border-[#ED383B]/50/50"}`}
              >
                <input ref={oneRef} type="file" accept=".pdf,.txt,.md,.doc,.docx,.rtf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setOnePagerFile(f); }} />
                {onePagerFile ? <CheckCircle2 className="w-6 h-6 text-[#ED383B] mx-auto mb-1.5" /> : <Upload className="w-6 h-6 text-[#6B5B5A] mx-auto mb-1.5" />}
                <p className="text-xs text-[#1A1414] font-semibold">Experience Transcript <span className="text-[#6B5B5A]">(optional)</span></p>
                <p className="text-[11px] text-[#6B5B5A] mt-0.5 truncate">{onePagerFile ? onePagerFile.name : "The detail your CV leaves out"}</p>
              </div>
            </div>

            {!cvFile && (
              <div className="mt-3">
                <Field label="Or paste your resume text" hint="if you don't have the file handy">
                  <textarea
                    rows={4}
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your CV / background here — roles, companies, dates, what you achieved."
                    className={areaCls}
                  />
                </Field>
              </div>
            )}

            {!onePagerFile && (
              <div className="mt-3">
                <Field label="Experience transcript" hint="optional, but this is where the good material lives">
                  <textarea
                    rows={3}
                    value={onePagerText}
                    onChange={(e) => setOnePagerText(e.target.value)}
                    placeholder="What you actually built, the real numbers, what broke, what you'd do differently. Specifics beat summaries."
                    className={areaCls}
                  />
                </Field>
              </div>
            )}

            <Button
              onClick={submitDocuments}
              disabled={!cvFile && resumeText.trim().length < 30}
              className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 mt-4 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Analyze my profile
            </Button>
          </>
        )}

        {/* ── Manual tab — one input for every profile section ── */}
        {tab === "manual" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-[#6B5B5A]">
                Only your name, headline, or summary is required — fill in as much as you can, everything here feeds the writer.
              </p>
              {profile && (
                <button
                  type="button"
                  onClick={() => { setForm(profileToForm(profile)); toast.success("Loaded your saved profile into the form"); }}
                  className="text-xs font-medium text-[#ED383B] hover:underline shrink-0"
                >
                  Prefill from saved
                </button>
              )}
            </div>

            <Section title="Identity" blurb="Who you are and who you're writing for.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full name">
                  <input className={inputCls} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Amit Suryawanshi" />
                </Field>
                <Field label="Industry / niche">
                  <input className={inputCls} value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="B2B SaaS growth" />
                </Field>
              </div>
              <Field label="Headline" hint="who you are | problem you solve | proof">
                <input className={inputCls} value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Growth lead | I turn cold pipelines into predictable revenue | 3x ARR in 18 months" />
              </Field>
              <Field label="Target audience" hint="who should be reading your posts">
                <input className={inputCls} value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} placeholder="Founders and heads of growth at seed–Series B SaaS" />
              </Field>
              <Field label="Summary" hint="2–3 sentences on you and your edge">
                <textarea rows={3} className={areaCls} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="What you do, who you do it for, and why you're the one to listen to." />
              </Field>
            </Section>

            <Section title="Positioning & voice" blurb="The angle that makes you hard to ignore, and how it should sound.">
              <Field label="Positioning" hint="your category-of-one angle">
                <textarea rows={2} className={areaCls} value={form.positioning} onChange={(e) => set("positioning", e.target.value)} placeholder="The specific POV you hold that most people in your space don't." />
              </Field>
              <Field label="Voice / tone">
                <input className={inputCls} value={form.voiceTone} onChange={(e) => set("voiceTone", e.target.value)} placeholder="Direct, practitioner-first, allergic to buzzwords" />
              </Field>
              <Field label="Expertise" hint="one per line">
                <textarea rows={4} className={areaCls} value={form.expertise} onChange={(e) => set("expertise", e.target.value)} placeholder={"Outbound systems\nPricing & packaging\nSales-led onboarding"} />
              </Field>
            </Section>

            <Section title="Achievements" blurb="Real, specific wins — with the number where you have one.">
              <div className="space-y-2">
                {form.achievements.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <input
                      className={inputCls}
                      value={a.text}
                      onChange={(e) => set("achievements", form.achievements.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                      placeholder="Rebuilt the onboarding flow"
                    />
                    <input
                      className={`${inputCls} sm:w-40 shrink-0`}
                      value={a.metric}
                      onChange={(e) => set("achievements", form.achievements.map((x, j) => j === i ? { ...x, metric: e.target.value } : x))}
                      placeholder="+38% activation"
                    />
                    {form.achievements.length > 1 && (
                      <div className="pt-2.5">
                        <RemoveRow onClick={() => set("achievements", form.achievements.filter((_, j) => j !== i))} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <AddRow label="Add achievement" onClick={() => set("achievements", [...form.achievements, { text: "", metric: "" }])} />
            </Section>

            <Section title="Career history" blurb="The roles worth writing from.">
              <div className="space-y-3">
                {form.roles.map((r, i) => (
                  <div key={i} className="rounded-lg border border-[#F2DAD8] p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                        <input className={inputCls} value={r.title}
                          onChange={(e) => set("roles", form.roles.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                          placeholder="Title" />
                        <input className={inputCls} value={r.company}
                          onChange={(e) => set("roles", form.roles.map((x, j) => j === i ? { ...x, company: e.target.value } : x))}
                          placeholder="Company" />
                        <input className={inputCls} value={r.period}
                          onChange={(e) => set("roles", form.roles.map((x, j) => j === i ? { ...x, period: e.target.value } : x))}
                          placeholder="2022 – present" />
                      </div>
                      {form.roles.length > 1 && (
                        <div className="pt-2.5">
                          <RemoveRow onClick={() => set("roles", form.roles.filter((_, j) => j !== i))} />
                        </div>
                      )}
                    </div>
                    <textarea rows={2} className={areaCls} value={r.highlights}
                      onChange={(e) => set("roles", form.roles.map((x, j) => j === i ? { ...x, highlights: e.target.value } : x))}
                      placeholder="Highlights — one per line" />
                  </div>
                ))}
              </div>
              <AddRow label="Add role" onClick={() => set("roles", [...form.roles, { title: "", company: "", period: "", highlights: "" }])} />
            </Section>

            <Section title="Stories & specifics" blurb="The raw material posts get written from.">
              <Field label="Signature stories" hint="one per line — pivots, failures, turning points">
                <textarea rows={4} className={areaCls} value={form.signatureStories} onChange={(e) => set("signatureStories", e.target.value)} placeholder={"The launch that flopped and what we changed\nWhy I turned down the bigger offer"} />
              </Field>
              <Field label="Concrete details" hint="one per line — exact numbers, tools, what broke">
                <textarea rows={4} className={areaCls} value={form.transcriptDetail} onChange={(e) => set("transcriptDetail", e.target.value)} placeholder={"Cut CAC from $310 to $190 in 5 months\nMoved off HubSpot workflows to a custom queue"} />
              </Field>
            </Section>

            <Section title="Content plan" blurb="What you post about, and what each post is working toward.">
              <div className="space-y-2">
                {form.contentPillars.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <input className={`${inputCls} sm:w-48 shrink-0`} value={c.name}
                      onChange={(e) => set("contentPillars", form.contentPillars.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Pillar name" />
                    <input className={inputCls} value={c.description}
                      onChange={(e) => set("contentPillars", form.contentPillars.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                      placeholder="What you post about under it" />
                    {form.contentPillars.length > 1 && (
                      <div className="pt-2.5">
                        <RemoveRow onClick={() => set("contentPillars", form.contentPillars.filter((_, j) => j !== i))} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <AddRow label="Add pillar" onClick={() => set("contentPillars", [...form.contentPillars, { name: "", description: "" }])} />

              <Field label="Post ideas" hint="one per line — these show up as clickable topics">
                <textarea rows={4} className={areaCls} value={form.postIdeas} onChange={(e) => set("postIdeas", e.target.value)} placeholder={"The pricing change that doubled trials\nWhat I got wrong about outbound in 2024"} />
              </Field>
            </Section>

            <Section title="Goals" blurb="Where you want LinkedIn to take you — content gets steered toward this.">
              <Field label="Goal" hint="one line">
                <input className={inputCls} value={form.goals} onChange={(e) => set("goals", e.target.value)} placeholder="Build inbound so I stop cold-emailing for clients" />
              </Field>
              <Field label="Objectives" hint="one per line">
                <textarea rows={3} className={areaCls} value={form.objectives} onChange={(e) => set("objectives", e.target.value)} placeholder={"5 qualified inbound leads a month\nSpeaking slot at a category conference"} />
              </Field>
              <Field label="Content strategy" hint="the through-line connecting your experience to your goal">
                <textarea rows={3} className={areaCls} value={form.contentStrategy} onChange={(e) => set("contentStrategy", e.target.value)} placeholder="2–3 sentences on the spine of your content plan." />
              </Field>
            </Section>

            <Button
              onClick={submitManual}
              disabled={saving}
              className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save my profile
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        {profile && (
          <button
            onClick={() => setView("saved")}
            className="flex items-center gap-1.5 text-xs text-[#6B5B5A] hover:text-[#1A1414] mt-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to saved profile
          </button>
        )}
      </div>
    </div>
  );
}
