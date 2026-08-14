"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Sparkles, Copy, Check, RefreshCw, Image as ImageIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ProfileKit {
  banner: {
    tagline: string;
    pillars: string[];
    name: string;
    email?: string;
    visual: string;
    visualConcept: string;
    layout: { left: string; center: string; right: string };
  };
  headlines: { text: string; why: string; whenToUse: string; recommended?: boolean }[];
  about: { text: string; characterCount: number };
  alignment: string[];
  refine: string[];
}

const THEMES = [
  { k: "navy", label: "Navy", dot: "#0B1F3A" },
  { k: "graphite", label: "Graphite", dot: "#16181D" },
  { k: "forest", label: "Forest", dot: "#10241C" },
  { k: "slate", label: "Slate", dot: "#101B26" },
  { k: "ivory", label: "Ivory", dot: "#F4F1EA" },
] as const;

const VISUALS = [
  { k: "arc", label: "Arc", hint: "insight → foresight, growth" },
  { k: "layers", label: "Layers", hint: "systems, platforms" },
  { k: "signal", label: "Signal", hint: "data, clarity" },
  { k: "grid", label: "Grid", hint: "operations, scale" },
  { k: "path", label: "Path", hint: "non-linear journeys" },
] as const;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
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

export default function BrandingPage() {
  const [kit, setKit] = useState<ProfileKit | null>(null);
  const [hasProfile, setHasProfile] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [theme, setTheme] = useState<string>("navy");
  const [visual, setVisual] = useState<string>("");
  // Bumped after each generate so the browser refetches the banner instead of
  // serving the previous render from cache.
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile-kit");
        if (res.ok) {
          const d = await res.json();
          setKit(d.kit);
          setHasProfile(d.hasProfile);
          if (d.kit?.banner?.visual) setVisual(d.kit.banner.visual);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: targetRole.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Could not build your kit"); return; }
      setKit(d.kit);
      setVisual(d.kit.banner.visual);
      setStamp(Date.now());
      toast.success("Profile kit ready — banner, headline and About.");
    } catch { setError("Something went wrong"); }
    finally { setBusy(false); }
  }

  const bannerSrc = kit
    ? `/api/profile-kit/banner?theme=${theme}&visual=${visual || kit.banner.visual}&scale=1&v=${stamp}`
    : "";
  const downloadHref = kit
    ? `/api/profile-kit/banner?theme=${theme}&visual=${visual || kit.banner.visual}&download=1`
    : "";

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-[#6B6B6B]">
        <Loader2 className="w-4 h-4 animate-spin text-[#ED383B]" /> Loading your profile kit…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight">Profile Kit</h1>
        <p className="text-[#6B6B6B] text-sm mt-1">
          Banner, headline and About — written as one system, so a recruiter reading all three
          in 30 seconds gets a single clear picture.
        </p>
      </div>

      {!hasProfile && (
        <div className="rounded-xl border border-[#F5C5C7] bg-[#FCEBEC] p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-[#ED383B] shrink-0 mt-0.5" />
          <p className="text-sm text-[#1A1A1A]">
            Build your profile first — upload your CV or fill in the sections on the Create page.
            Everything here is written from it.
          </p>
        </div>
      )}

      {/* Generate */}
      <div className="rounded-2xl bg-[#FFFFFF] border border-[#F5C5C7] p-5 space-y-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-[#1A1A1A]">Target role &amp; company type</Label>
          <Input
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Senior FP&A / analytics lead at a scaling fintech"
            className="bg-[#FFFFFF] border-[#F5C5C7] text-[#1A1A1A] placeholder:text-[#6B6B6B] rounded-xl h-10 text-sm"
          />
          <p className="text-xs text-[#6B6B6B]">Optional, but all three assets get sharper when they point at one target.</p>
        </div>
        <Button
          onClick={generate}
          disabled={busy || !hasProfile}
          className="w-full h-11 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : kit ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Writing your kit…" : kit ? "Regenerate" : "Build my profile kit"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {kit && (
        <>
          {/* ── Banner ── */}
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#F5C5C7] overflow-hidden">
            <div className="p-5 pb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[#1A1A1A] font-semibold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#ED383B]" /> LinkedIn banner
                </h2>
                <p className="text-xs text-[#6B6B6B] mt-0.5">1584 × 396 · downloads at 2× for a sharp upload</p>
              </div>
              <a
                href={downloadHref}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#ED383B] hover:bg-[#ED383B]/90 text-white text-xs font-semibold shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Download PNG
              </a>
            </div>

            <div className="px-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerSrc} alt="Your LinkedIn banner" className="w-full rounded-xl border border-[#F5C5C7]" />
              <p className="text-[11px] text-[#6B6B6B] mt-1.5">
                The left quarter is intentionally empty — LinkedIn drops your profile photo there.
              </p>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] font-semibold w-14">Colour</span>
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] font-semibold w-14">Diagram</span>
                {VISUALS.map((v) => (
                  <button
                    key={v.k}
                    onClick={() => setVisual(v.k)}
                    title={v.hint}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                      (visual || kit.banner.visual) === v.k ? "border-[#ED383B] text-[#ED383B] bg-[#ED383B]/10" : "border-[#F5C5C7] text-[#6B6B6B]"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-[#FCEBEC] border border-[#F5C5C7] p-4 space-y-1.5 text-xs">
                <p className="text-[#1A1A1A]"><span className="text-[#6B6B6B]">Tagline:</span> <span className="font-semibold">{kit.banner.tagline}</span></p>
                <p className="text-[#1A1A1A]"><span className="text-[#6B6B6B]">Pillars:</span> {kit.banner.pillars.join("  |  ")}</p>
                {kit.banner.visualConcept && (
                  <p className="text-[#1A1A1A]"><span className="text-[#6B6B6B]">Visual concept:</span> {kit.banner.visualConcept}</p>
                )}
                <p className="text-[#6B6B6B]">Left: {kit.banner.layout.left}</p>
                <p className="text-[#6B6B6B]">Center: {kit.banner.layout.center}</p>
                <p className="text-[#6B6B6B]">Right: {kit.banner.layout.right}</p>
              </div>
            </div>
          </section>

          {/* ── Headlines ── */}
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#F5C5C7] p-5 space-y-3">
            <h2 className="text-[#1A1A1A] font-semibold">Headline options</h2>
            {kit.headlines.map((h, i) => (
              <div key={i} className={`rounded-xl border p-4 space-y-2 ${h.recommended ? "border-[#ED383B]/40 bg-[#ED383B]/5" : "border-[#F5C5C7]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {h.recommended && (
                      <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-[#ED383B] mb-1">Recommended</span>
                    )}
                    <p className="text-sm text-[#1A1A1A] font-medium break-words">{h.text}</p>
                  </div>
                  <CopyButton text={h.text} />
                </div>
                <p className="text-xs text-[#6B6B6B]">{h.why}</p>
                {h.whenToUse && <p className="text-xs text-[#6B6B6B]"><span className="font-medium">Use when:</span> {h.whenToUse}</p>}
                <p className="text-[10px] text-[#6B6B6B]">{h.text.length} / 220 characters</p>
              </div>
            ))}
          </section>

          {/* ── About ── */}
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#F5C5C7] p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[#1A1A1A] font-semibold">About section</h2>
              <CopyButton text={kit.about.text} label="Copy About" />
            </div>
            <p className="text-sm text-[#1A1A1A] whitespace-pre-line leading-relaxed">{kit.about.text}</p>
            <p className={`text-xs ${kit.about.characterCount > 1600 ? "text-red-500" : "text-[#6B6B6B]"}`}>
              {kit.about.characterCount} characters {kit.about.characterCount > 1600 ? "— over the 1,600 target" : "· target 1,400–1,600"}
            </p>
          </section>

          {/* ── Alignment + refine ── */}
          {(kit.alignment.length > 0 || kit.refine.length > 0) && (
            <section className="rounded-2xl bg-[#FCEBEC] border border-[#F5C5C7] p-5 space-y-3">
              {kit.alignment.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-[#6B6B6B] mb-1.5">Alignment check</h3>
                  <ul className="space-y-1">
                    {kit.alignment.map((a, i) => (
                      <li key={i} className="text-xs text-[#1A1A1A] flex gap-2"><Check className="w-3.5 h-3.5 text-[#ED383B] shrink-0 mt-0.5" />{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {kit.refine.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-[#6B6B6B] mb-1.5">What to refine next</h3>
                  <ul className="space-y-1">
                    {kit.refine.map((r, i) => (
                      <li key={i} className="text-xs text-[#6B6B6B]">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
