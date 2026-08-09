"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Sparkles, CheckCircle2, RefreshCw, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface CreatorProfile {
  fullName?: string;
  headline?: string;
  industry?: string;
  targetAudience?: string;
  summary?: string;
  positioning?: string;
  expertise?: string[];
  contentPillars?: { name: string; description: string }[];
  postIdeas?: string[];
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
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [reopen, setReopen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // CV + optional one-pager
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [onePagerFile, setOnePagerFile] = useState<File | null>(null);
  const [onePagerText, setOnePagerText] = useState("");
  const oneRef = useRef<HTMLInputElement>(null);

  async function submitProfile() {
    if (!cvFile) {
      toast.error("Add your CV / resume first");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", cvFile);
      if (onePagerFile) fd.append("onePager", onePagerFile);
      else if (onePagerText.trim()) fd.append("onePagerText", onePagerText.trim());
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
        return;
      }
      setProfile(data.profile.data);
      onProfileReady?.(data.profile.data);
      setReopen(false);
      setCvFile(null);
      setOnePagerFile(null);
      setOnePagerText("");
      toast.success("Profile analyzed — content is now personalized to you.");
    } catch {
      setError("Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }

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

  async function submitFile(file: File) {
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
        return;
      }
      setProfile(data.profile.data);
      onProfileReady?.(data.profile.data);
      setReopen(false);
      toast.success("Resume analyzed — content is now personalized to you.");
    } catch {
      setError("Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitText() {
    if (text.trim().length < 30) {
      toast.error("Paste a bit more of your resume");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
        return;
      }
      setProfile(data.profile.data);
      onProfileReady?.(data.profile.data);
      setReopen(false);
      setText("");
      toast.success("Resume analyzed — content is now personalized to you.");
    } catch {
      setError("Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#1e293b] border border-[#334155] p-5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-[#ED383B] animate-spin" />
        <span className="text-sm text-slate-400">Checking your profile…</span>
      </div>
    );
  }

  // ── Analyzing state ──
  if (analyzing) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-[#ED383B]/15 to-[#7F1D1F]/10 border border-[#ED383B]/30 p-6 text-center">
        <Loader2 className="w-8 h-8 text-[#ED383B] animate-spin mx-auto mb-3" />
        <h3 className="text-white font-semibold">Analyzing your resume…</h3>
        <p className="text-slate-400 text-sm mt-1">Extracting your experience, achievements, voice, and positioning.</p>
      </div>
    );
  }

  // ── Profile exists ──
  if (profile && !reopen) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-[#ED383B]/12 to-[#7F1D1F]/8 border border-[#ED383B]/25 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ED383B]/15 border border-[#ED383B]/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#ED383B]" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  Personalizing from {profile.fullName || "your"} resume
                </p>
                {profile.headline && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{profile.headline}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setReopen(true); setMode("upload"); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#ED383B] hover:bg-[#ED383B]/10"
                title="Re-upload resume"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 space-y-4">
              {profile.expertise && profile.expertise.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1.5">Expertise</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.expertise.slice(0, 8).map((e, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-[#0f172a] border border-[#334155] text-slate-300">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.postIdeas && profile.postIdeas.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-[#ED383B]" />
                    Post ideas from your experience — click to use
                  </p>
                  <div className="space-y-1.5">
                    {profile.postIdeas.slice(0, 8).map((idea, i) => (
                      <button
                        key={i}
                        onClick={() => { onUseIdea?.(idea); toast.success("Idea loaded into the topic field"); }}
                        className="w-full text-left text-xs text-slate-300 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 hover:border-[#ED383B]/40 hover:text-white transition-colors"
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

  // ── Upload / paste (no profile yet, or re-uploading) ──
  return (
    <div className="rounded-2xl bg-[#1e293b] border border-[#334155] overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[#ED383B]/15 border border-[#ED383B]/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#ED383B]" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Create your profile</h3>
            <p className="text-xs text-slate-400">Upload your CV and (optionally) a one-pager on your goals. We analyze both to craft sharper content.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* CV slot (required) */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setCvFile(f); }}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${cvFile ? "border-[#ED383B]/60 bg-[#ED383B]/5" : "border-[#334155] hover:border-[#ED383B]/50"}`}
          >
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.doc,.docx,.rtf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setCvFile(f); }} />
            {cvFile ? <CheckCircle2 className="w-6 h-6 text-[#ED383B] mx-auto mb-1.5" /> : <FileText className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />}
            <p className="text-xs text-slate-300 font-semibold">CV / Resume <span className="text-[#ED383B]">*</span></p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{cvFile ? cvFile.name : "Any format · click to upload"}</p>
          </div>

          {/* One-pager slot (optional) */}
          <div
            onClick={() => oneRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setOnePagerFile(f); }}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${onePagerFile ? "border-[#ED383B]/60 bg-[#ED383B]/5" : "border-[#334155] hover:border-[#ED383B]/50"}`}
          >
            <input ref={oneRef} type="file" accept=".pdf,.txt,.md,.doc,.docx,.rtf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setOnePagerFile(f); }} />
            {onePagerFile ? <CheckCircle2 className="w-6 h-6 text-[#ED383B] mx-auto mb-1.5" /> : <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />}
            <p className="text-xs text-slate-300 font-semibold">One-pager <span className="text-slate-500">(optional)</span></p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{onePagerFile ? onePagerFile.name : "Goals & what to work on"}</p>
          </div>
        </div>

        {/* Optional: paste one-pager text if they don't have a file */}
        {!onePagerFile && (
          <Textarea
            value={onePagerText}
            onChange={(e) => setOnePagerText(e.target.value)}
            rows={3}
            placeholder="Or briefly type your goals: what you want to work on, who you want to reach, what you're aiming for…"
            className="bg-[#0f172a] border-[#334155] text-white text-sm rounded-xl placeholder:text-slate-500 mt-3"
          />
        )}

        <Button
          onClick={submitProfile}
          disabled={!cvFile}
          className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 mt-3 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Analyze my profile
        </Button>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        {reopen && (
          <button
            onClick={() => setReopen(false)}
            className="text-xs text-slate-400 hover:text-white mt-3"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
