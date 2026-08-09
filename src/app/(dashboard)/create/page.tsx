"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { LinkedInPreview } from "@/components/linkedin-preview";
import { ResumeOnboarding } from "@/components/resume-onboarding";
import { STYLE_META } from "@/lib/image-prompt";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  FileText,
  Layers,
  MessageSquare,
  BarChart3,
  Pencil,
  X,
  ImageIcon,
  Download,
  RefreshCw,
  Wand2,
  Calendar as CalendarIcon,
  Send,
  Clock,
} from "lucide-react";

type PostType = "text" | "carousel" | "article" | "poll";
type Step = "form" | "generating" | "done";

interface GeneratedPost {
  id: string;
  postType: string;
  hookCategory: string;
  hook: string;
  body: string;
  hashtags: string[];
  cta: string;
  whyThisWorks: string;
  variations: string[];
  carouselSlides?: { slideNumber: number; title: string; body: string; designDirection: string }[] | null;
  approvalStatus: string;
  imageUrl?: string | null;
  carouselImages?: string[] | null;
}

const POST_TYPES: { value: PostType; label: string; description: string; icon: React.ElementType }[] = [
  { value: "text", label: "Text Post", description: "Classic LinkedIn text post — most popular format", icon: FileText },
  { value: "carousel", label: "Carousel", description: "Multi-slide document — highest engagement", icon: Layers },
  { value: "article", label: "Article", description: "Long-form article outline for thought leadership", icon: MessageSquare },
  { value: "poll", label: "Poll", description: "Interactive poll that sparks conversation", icon: BarChart3 },
];

const INDUSTRIES = [
  "Technology / SaaS", "Finance / Fintech", "Marketing / Advertising",
  "Healthcare", "Consulting", "Startups", "E-commerce", "Education",
  "Real Estate", "Manufacturing", "Legal", "HR / Recruiting", "Other",
];

const TONES = [
  "Professional", "Conversational", "Inspirational", "Educational",
  "Provocative", "Storytelling",
];

const COUNTS = [1, 2, 3, 5];

// Group styles by category once for the picker.
const STYLE_GROUPS = STYLE_META.reduce<Record<string, typeof STYLE_META>>((acc, s) => {
  (acc[s.category] ||= []).push(s);
  return acc;
}, {});

function PostCard({ post, userName, index }: { post: GeneratedPost; userName: string; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editHook, setEditHook] = useState(post.hook);
  const [editBody, setEditBody] = useState(post.body);
  const [saving, setSaving] = useState(false);

  // ── Schedule / Post Now ──
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDate, setSchedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [schedTime, setSchedTime] = useState("09:00");
  const [statusBusy, setStatusBusy] = useState(false);
  const [postStatus, setPostStatus] = useState(post.approvalStatus || "draft");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  // ── Premium image generation (Gathos) — 24 luxury styles ──
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl ?? null);
  const [imgStyle, setImgStyle] = useState<string>("auto");
  const [imgStyleName, setImgStyleName] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const isCarousel = post.postType === "carousel";
  const [carouselImages, setCarouselImages] = useState<string[]>(post.carouselImages ?? []);
  const [carLoading, setCarLoading] = useState(false);
  const [carError, setCarError] = useState<string | null>(null);

  async function generateCarousel() {
    setCarLoading(true);
    setCarError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/carousel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCarError(data.error || "Carousel generation failed");
        return;
      }
      setCarouselImages(data.images || []);
      post.carouselImages = data.images || [];
    } catch {
      setCarError("Network error — try again");
    } finally {
      setCarLoading(false);
    }
  }

  async function generateImage(style: string) {
    setImgLoading(true);
    setImgError(null);
    setImgStyle(style);
    try {
      const res = await fetch(`/api/posts/${post.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // For "auto", let the server pick a RANDOM style each time (so posts vary
        // and every regenerate gives a fresh look). A specific style is sent as-is.
        body: JSON.stringify(style === "auto" ? {} : { style }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImgError(data.error || "Image generation failed");
        return;
      }
      setImageUrl(data.imageUrl);
      setImgStyleName(data.styleName || null);
      post.imageUrl = data.imageUrl;
    } catch {
      setImgError("Network error — try again");
    } finally {
      setImgLoading(false);
    }
  }

  // Auto-generate on first appearance: a full carousel deck for carousel posts,
  // otherwise a single premium image.
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    if (isCarousel) {
      if (carouselImages.length === 0) generateCarousel();
    } else if (!imageUrl) {
      generateImage("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildFullPost(hook: string, body: string, hashtags: string[]) {
    const hashtagStr = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
    return `${hook}\n\n${body}\n\n${hashtagStr}`;
  }

  async function copyToClipboard(text: string, idx?: number) {
    try {
      await navigator.clipboard.writeText(text);
      if (idx !== undefined) {
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      toast.success("Copied to clipboard! Paste it into LinkedIn.");
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: editHook, body: editBody }),
      });
      if (res.ok) {
        post.hook = editHook;
        post.body = editBody;
        setEditing(false);
        toast.success("Post updated");
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handlePostNow() {
    setStatusBusy(true);
    try {
      // Put the full post on the clipboard so it's ready to paste.
      try {
        await navigator.clipboard.writeText(buildFullPost(post.hook, post.body, post.hashtags));
      } catch { /* clipboard may be blocked; publish still records */ }

      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to publish");
        return;
      }
      setPostStatus("published");
      post.approvalStatus = "published";
      window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
      toast.success("Copied! Paste into LinkedIn — opened in a new tab.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStatusBusy(false);
    }
  }

  async function confirmSchedule() {
    if (!schedDate || !schedTime) {
      toast.error("Pick a date and time");
      return;
    }
    setStatusBusy(true);
    try {
      const iso = new Date(`${schedDate}T${schedTime}:00`).toISOString();
      const res = await fetch("/api/posts/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, scheduledAt: iso }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to schedule");
        return;
      }
      setPostStatus("scheduled");
      post.approvalStatus = "scheduled";
      setScheduledAt(iso);
      setSchedOpen(false);
      toast.success("Scheduled — added to your Calendar");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden hover:border-[#ED383B]/40 transition-all">
      {/* Header */}
      <div className="p-5 pb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-[#ED383B]/10 text-[#ED383B] border border-[#ED383B]/20">
          {post.hookCategory}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditing(!editing); setEditHook(post.hook); setEditBody(post.body); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#ED383B] hover:bg-[#ED383B]/10 transition-colors"
            title="Edit post"
          >
            {editing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* LinkedIn Preview or Edit Mode */}
      <div className="px-5">
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400 mb-1">Hook (first 2 lines)</Label>
              <Textarea
                value={editHook}
                onChange={(e) => setEditHook(e.target.value)}
                rows={2}
                className="bg-[#0f172a] border-[#334155] text-white text-sm rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1">Body</Label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={8}
                className="bg-[#0f172a] border-[#334155] text-white text-sm rounded-xl"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                className="rounded-lg border-[#334155] text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg bg-[#ED383B] hover:bg-[#ED383B]/90 text-white gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <LinkedInPreview
            name={userName}
            hook={post.hook}
            body={post.body}
            hashtags={post.hashtags}
            postType={post.postType}
          />
        )}
      </div>

      {/* Carousel Slides */}
      {post.carouselSlides && post.carouselSlides.length > 0 && (
        <div className="px-5 mt-3">
          <p className="text-xs text-slate-400 font-medium mb-2">Carousel Slides ({post.carouselSlides.length})</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {post.carouselSlides.map((slide, i) => (
              <div
                key={i}
                className="min-w-[200px] max-w-[200px] bg-[#0f172a] border border-[#334155] rounded-xl p-3 shrink-0"
              >
                <p className="text-[10px] text-[#ED383B] font-medium mb-1">Slide {slide.slideNumber}</p>
                <p className="text-sm font-bold text-white mb-1 line-clamp-2">{slide.title}</p>
                <p className="text-xs text-slate-400 line-clamp-3">{slide.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carousel deck (multi-slide) */}
      {isCarousel && (
        <div className="px-5 mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#ED383B]" />
              Carousel {carouselImages.length > 0 && <span className="text-slate-500">· {carouselImages.length} slides</span>}
            </p>
            <button
              onClick={generateCarousel}
              disabled={carLoading}
              className="text-[11px] rounded-lg bg-[#ED383B] text-white px-2.5 py-1 font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {carLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {carouselImages.length > 0 ? "Regenerate" : "Generate"}
            </button>
          </div>
          {carLoading ? (
            <div className="rounded-xl border border-[#334155] bg-[#0f172a] aspect-[4/5] flex items-center justify-center">
              <div className="text-center px-4">
                <Loader2 className="w-7 h-7 text-[#ED383B] animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Designing your carousel slides…</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Gathos AI · ~60–120s</p>
              </div>
            </div>
          ) : carouselImages.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
              {carouselImages.map((url, i) => (
                <div key={i} className="relative shrink-0 w-[70%] snap-start rounded-xl overflow-hidden border border-[#334155] bg-[#0f172a]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-auto" />
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/60 text-white">
                    {i + 1}/{carouselImages.length}
                  </span>
                  <a href={url} download className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/70">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#334155] bg-[#0f172a] p-6 text-center">
              <Layers className="w-7 h-7 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">{carError || "No carousel yet"}</p>
              <button onClick={generateCarousel} className="mt-2 text-xs text-[#ED383B] hover:text-[#DB272A] font-medium">
                Generate carousel slides
              </button>
            </div>
          )}
        </div>
      )}

      {/* Premium image (Gathos) — single image for non-carousel posts */}
      {!isCarousel && (
      <div className="px-5 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#ED383B]" />
            Premium Image
            {imgStyleName && <span className="text-slate-500">· {imgStyleName}</span>}
          </p>
          <select
            value={imgStyle}
            onChange={(e) => generateImage(e.target.value)}
            disabled={imgLoading}
            className="text-[11px] rounded-lg bg-[#0f172a] border border-[#334155] text-slate-300 px-2 py-1 focus:border-[#ED383B] outline-none disabled:opacity-50 max-w-[160px]"
          >
            <option value="auto">✨ Auto (Surprise me)</option>
            {Object.entries(STYLE_GROUPS).map(([cat, styles]) => (
              <optgroup key={cat} label={cat}>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-[#334155] bg-[#0f172a] aspect-[4/5] flex items-center justify-center">
          {imgLoading ? (
            <div className="text-center px-4">
              <Loader2 className="w-7 h-7 text-[#ED383B] animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Designing your premium visual…</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Gathos AI · ~30–90s</p>
            </div>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Generated premium visual" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center px-4">
              <Wand2 className="w-7 h-7 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">{imgError || "No image yet"}</p>
              <button
                onClick={() => generateImage(imgStyle)}
                className="mt-2 text-xs text-[#ED383B] hover:text-[#DB272A] font-medium"
              >
                Generate premium image
              </button>
            </div>
          )}

          {imageUrl && !imgLoading && (
            <div className="absolute top-2 right-2 flex gap-1.5">
              <a
                href={imageUrl}
                download
                className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => generateImage(imgStyle)}
                className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 space-y-3">
        {/* Copy button */}
        <Button
          onClick={() => copyToClipboard(buildFullPost(post.hook, post.body, post.hashtags))}
          className="w-full bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl gap-2 h-10"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Post to Clipboard"}
        </Button>

        {/* Schedule / Post Now */}
        {postStatus === "published" ? (
          <div className="flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
            <Check className="w-4 h-4" /> Marked as posted
          </div>
        ) : postStatus === "scheduled" ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 h-10">
            <span className="flex items-center gap-2 text-amber-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Scheduled{scheduledAt ? ` · ${new Date(scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${new Date(scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
            </span>
            <button
              onClick={() => { setPostStatus("draft"); setScheduledAt(null); setSchedOpen(true); }}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handlePostNow}
                disabled={statusBusy}
                className="w-full h-10 bg-[#0f172a] hover:bg-[#0f172a]/70 border border-[#334155] text-white font-medium rounded-xl gap-2 disabled:opacity-50"
              >
                {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post Now
              </Button>
              <Button
                onClick={() => setSchedOpen((v) => !v)}
                disabled={statusBusy}
                className="w-full h-10 bg-[#0f172a] hover:bg-[#0f172a]/70 border border-[#334155] text-white font-medium rounded-xl gap-2 disabled:opacity-50"
              >
                <CalendarIcon className="w-4 h-4" />
                Schedule
              </Button>
            </div>
            {schedOpen && (
              <div className="rounded-xl bg-[#0f172a] border border-[#334155] p-3 space-y-2.5">
                <p className="text-xs text-slate-400 font-medium">Pick a date & time — it lands on your Calendar.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-[#334155] bg-[#1e293b] text-white outline-none focus:border-[#ED383B]"
                  />
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="text-xs px-2.5 py-2 rounded-lg border border-[#334155] bg-[#1e293b] text-white outline-none focus:border-[#ED383B]"
                  />
                </div>
                <Button
                  onClick={confirmSchedule}
                  disabled={statusBusy}
                  className="w-full h-9 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white text-sm font-semibold rounded-lg gap-2 disabled:opacity-50"
                >
                  {statusBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarIcon className="w-3.5 h-3.5" />}
                  Confirm Schedule
                </Button>
              </div>
            )}
          </>
        )}

        {/* Why this works */}
        <button
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors w-full justify-center"
          onClick={() => setExpanded(!expanded)}
        >
          Why this works
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <p className="text-xs text-slate-400 leading-relaxed bg-[#0f172a] rounded-xl p-3 border border-[#334155]">
            {post.whyThisWorks}
          </p>
        )}

        {/* Variations */}
        {post.variations && post.variations.length > 0 && (
          <>
            <button
              className="flex items-center gap-1.5 text-xs text-[#ED383B] hover:text-[#DB272A] transition-colors w-full justify-center font-medium"
              onClick={() => setShowVariations(!showVariations)}
            >
              {showVariations ? "Hide" : "Show"} {post.variations.length} Alternative Versions
              {showVariations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showVariations && (
              <div className="space-y-2">
                {post.variations.map((v, i) => (
                  <div
                    key={i}
                    className="bg-[#0f172a] border border-[#334155] rounded-xl p-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line flex-1">
                        {v}
                      </p>
                      <button
                        onClick={() => copyToClipboard(v, i)}
                        className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-[#ED383B] hover:bg-[#ED383B]/10 transition-colors"
                        title="Copy variation"
                      >
                        {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-red-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  const [step, setStep] = useState<Step>("form");
  const [topic, setTopic] = useState("");
  const [postType, setPostType] = useState<PostType>("text");
  const [postsCount, setPostsCount] = useState(3);
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tone, setTone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          postType,
          postsCount,
          industry: industry || undefined,
          targetAudience: targetAudience || undefined,
          tonePrefs: tone || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        toast.error(data.error || "Failed to generate posts");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setBatchId(data.batchId);

      // Parse JSON fields from the response
      const parsedPosts: GeneratedPost[] = data.posts.map((p: Record<string, unknown>) => ({
        ...p,
        hashtags: typeof p.hashtags === "string" ? JSON.parse(p.hashtags as string) : p.hashtags || [],
        variations: typeof p.variations === "string" ? JSON.parse(p.variations as string) : p.variations || [],
        carouselSlides: p.carouselSlides
          ? typeof p.carouselSlides === "string"
            ? JSON.parse(p.carouselSlides as string)
            : p.carouselSlides
          : null,
      }));

      setPosts(parsedPosts);
      setStep("done");
      toast.success(`${parsedPosts.length} LinkedIn post${parsedPosts.length !== 1 ? "s" : ""} generated!`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── FORM ──
  if (step === "form") {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">Create LinkedIn Post</h1>
          <p className="text-slate-400 text-sm mt-1">
            We craft every post from your real experience — starting with your resume.
          </p>
        </div>

        {/* Resume-first onboarding: the client's CV is the base for all content */}
        <div className="mb-6">
          <ResumeOnboarding onUseIdea={(idea) => setTopic(idea)} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Topic */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-300">
              What do you want to post about? <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why I stopped chasing job titles and started chasing skills instead. Share a personal story about a career pivot that led to unexpected growth..."
              rows={4}
              className="bg-[#1e293b] border-[#334155] text-white placeholder:text-slate-500 rounded-xl text-sm focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B]"
              required
            />
            <p className="text-xs text-slate-500">
              Tip: The more specific you are, the better the posts. Include personal angles, numbers, or contrarian takes.
            </p>
          </div>

          {/* Post Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-300">Post Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {POST_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPostType(pt.value)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    postType === pt.value
                      ? "border-[#ED383B] bg-[#ED383B]/10"
                      : "border-[#334155] bg-[#1e293b] hover:border-[#475569]"
                  }`}
                >
                  <pt.icon className={`w-5 h-5 mt-0.5 shrink-0 ${postType === pt.value ? "text-[#ED383B]" : "text-slate-400"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${postType === pt.value ? "text-[#ED383B]" : "text-white"}`}>
                      {pt.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{pt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Posts */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-300">Number of Posts</Label>
            <div className="flex gap-2">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPostsCount(n)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    postsCount === n
                      ? "bg-[#ED383B] text-white shadow-lg shadow-[#ED383B]/25"
                      : "bg-[#1e293b] text-slate-400 border border-[#334155] hover:border-[#475569]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Industry & Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Industry</Label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#1e293b] border border-[#334155] text-white text-sm focus:ring-[#ED383B]/30 focus:border-[#ED383B] outline-none"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-300">Target Audience</Label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Startup founders, Mid-level managers"
                className="bg-[#1e293b] border-[#334155] text-white placeholder:text-slate-500 rounded-xl h-10 text-sm focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B]"
              />
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-300">Tone & Style</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(tone === t ? "" : t)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    tone === t
                      ? "bg-[#ED383B] text-white"
                      : "bg-[#1e293b] text-slate-400 border border-[#334155] hover:border-[#475569]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !topic.trim()}
            className="w-full h-12 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl text-base gap-2 shadow-lg shadow-[#ED383B]/25 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating {postsCount} post{postsCount !== 1 ? "s" : ""}...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate {postsCount} LinkedIn Post{postsCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </form>
      </div>
    );
  }

  // ── GENERATING (loading state) ──
  if (step === "generating") {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-[#ED383B]/10 border border-[#ED383B]/20 flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-[#ED383B] animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Generating your LinkedIn posts...</h2>
        <p className="text-slate-400 text-sm">This usually takes 15-30 seconds. Our AI is crafting scroll-stopping content.</p>
      </div>
    );
  }

  // ── DONE ──
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {posts.length} LinkedIn Post{posts.length !== 1 ? "s" : ""} Ready!
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review your posts, edit if needed, then copy and paste into LinkedIn.
          </p>
        </div>
        <button
          onClick={() => { setStep("form"); setPosts([]); setBatchId(null); }}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Create More
        </button>
      </div>

      {/* Post Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} userName="You" index={i} />
        ))}
      </div>
    </div>
  );
}
