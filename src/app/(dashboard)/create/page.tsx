"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { LinkedInPreview } from "@/components/linkedin-preview";
import { ResumeOnboarding } from "@/components/resume-onboarding";
import { SwipeDeck } from "@/components/swipe-deck";
import { DeckLightbox } from "@/components/deck-lightbox";
import { STYLE_META } from "@/lib/image-prompt";
import { LAB_STYLES } from "@/lib/deck-lab-styles";
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
  Pencil,
  X,
  ImageIcon,
  Download,
  RefreshCw,
  Wand2,
  Calendar as CalendarIcon,
  Send,
  Clock,
  Maximize2,
} from "lucide-react";
import { AccentIcon, ACCENTS, type Accent } from "@/components/accent-icon";
import { composePost } from "@/lib/utils";

type PostType = "text" | "carousel" | "article";
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

const POST_TYPES: { value: PostType; label: string; description: string; icon: React.ElementType; accent: Accent }[] = [
  { value: "text", label: "Text Post", description: "Classic LinkedIn text post — most popular format", icon: FileText, accent: "linkedin" },
  { value: "carousel", label: "Carousel", description: "Multi-slide document — highest engagement", icon: Layers, accent: "amber" },
  { value: "article", label: "Article", description: "Long-form article outline for thought leadership", icon: MessageSquare, accent: "slate" },
];

const TONES = [
  "Professional", "Conversational", "Inspirational", "Educational",
  "Provocative", "Storytelling",
];

const COUNTS = [1, 2, 3, 5];

// Reference files per generation. Gemini takes them all inline, so the ceiling
// is request size rather than the model — 8 files at 12MB each is the practical
// limit before the request itself becomes the problem.
const MAX_REF_FILES = 8;

// The create flow is a wizard rather than one long form: the resume gates
// everything (posts are written from it), and showing every field at once buried
// the one required field — the topic — among six optional ones.
type WizardStep = 1 | 2 | 3 | 4;
const WIZARD_STEPS: { n: WizardStep; label: string; blurb: string }[] = [
  { n: 1, label: "Resume", blurb: "Start with your resume — every post is written from your real experience." },
  { n: 2, label: "Topic", blurb: "What should this post be about?" },
  { n: 3, label: "Format", blurb: "Pick the post type and how many you want." },
  { n: 4, label: "Details", blurb: "Optional context that sharpens the result." },
];

// Group styles by category once for the picker.
const STYLE_GROUPS = STYLE_META.reduce<Record<string, typeof STYLE_META>>((acc, s) => {
  (acc[s.category] ||= []).push(s);
  return acc;
}, {});

function PostCard({ post, userName, index, solo = false }: { post: GeneratedPost; userName: string; index: number; solo?: boolean }) {
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

  // ── Premium image generation (Gemini) — 36 styles ──
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl ?? null);
  const [imgStyle, setImgStyle] = useState<string>("auto");
  const [imgStyleName, setImgStyleName] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const isCarousel = post.postType === "carousel";
  const [carouselImages, setCarouselImages] = useState<string[]>(post.carouselImages ?? []);
  const [carLoading, setCarLoading] = useState(false);
  // "tall" (4:5) is the LinkedIn-native ratio; "wide" is the spec's 16:9 deck.
  const [deckShape, setDeckShape] = useState<"tall" | "wide">("tall");
  // "swipe" = the minimalist creator deck (default — it is what wins on LinkedIn);
  // "attention" = swipe plus highlight chips, Q&A, bar charts and a follow CTA;
  // "editorial" = multi-colour with icons/charts; "koyopo" = the flat red brand deck.
  const [deckStyle, setDeckStyle] = useState<"swipe" | "attention" | "editorial" | "koyopo" | "photo" | "visual" | "campaign" | string>("swipe");
  // Illustrated deck: generate art for slides with no uploaded image. Off by
  // default — a 10-slide deck is 10 image calls.
  const [genArt, setGenArt] = useState(false);
  // How many slides to render. 0 = every slide the model wrote. Trimming keeps
  // the cover and the closing CTA and cuts the middle, so a shorter deck still
  // opens and closes properly.
  const [deckCount, setDeckCount] = useState<number>(0);
  const [carError, setCarError] = useState<string | null>(null);
  // Index of the slide open full screen; null when the viewer is closed.
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [dlBusy, setDlBusy] = useState<"pdf" | "pptx" | null>(null);
  const slideTotal = post.carouselSlides?.length ?? 0;

  async function generateCarousel() {
    setCarLoading(true);
    setCarError(null);
    try {
      // Two engines behind one button. The vector styles draw flat colour and
      // type directly — no key, nothing per deck. "Photo" composes the same copy
      // over a generated photographic background, which is how a carousel gets a
      // premium image: a LinkedIn document post is ONE upload, so the visual has
      // to live inside the deck rather than beside it.
      const isPhoto = deckStyle === "photo";
      const res = await fetch(`/api/posts/${post.id}/${isPhoto ? "carousel" : "koyopo"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isPhoto
            ? { maxSlides: deckCount || undefined }
            : {
                canvas: deckShape,
                format: "png",
                style: deckStyle,
                maxSlides: deckCount || undefined,
                // The toggle is shown for every style that can carry a picture,
                // so the request has to carry it for all of them. Sending it
                // only for "visual" meant the button did nothing on the seven
                // spec styles — it rendered, it just never reached the server.
                generateArt: deckStyle === "visual" || deckStyle in LAB_STYLES ? genArt : undefined,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCarError(data.error || "Carousel generation failed");
        return;
      }
      setCarouselImages(data.images || []);
      post.carouselImages = data.images || [];
      renderedKey.current = settingsKey;
    } catch {
      setCarError("Network error — try again");
    } finally {
      setCarLoading(false);
    }
  }

  async function downloadDeck(format: "pdf" | "pptx") {
    setDlBusy(format);
    setCarError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/koyopo?format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCarError(data.error || `Could not build the .${format}`);
        return;
      }
      // The blob is handed to a throwaway anchor so the browser saves it instead
      // of navigating; the object URL is revoked once the click is dispatched.
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `deck-${deckStyle}-${deckShape}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(format === "pdf" ? "PDF downloaded — upload it to LinkedIn as a document post" : "PowerPoint downloaded");
    } catch {
      setCarError("Network error — try again");
    } finally {
      setDlBusy(null);
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

  // NOTHING generates on its own. Rendering a deck or an image happens only when
  // the user clicks a button — previously both auto-started, which meant a
  // generation the user never asked for (and, on the Photo style, quota spent
  // before they had chosen anything).

  // Changing style/shape/slide-count marks the deck on screen as stale rather
  // than re-rendering behind the user's back. They press Render when ready.
  const renderedKey = useRef<string | null>(null);
  const settingsKey = `${deckStyle}:${deckShape}:${deckCount}:${genArt}`;
  const deckStale = carouselImages.length > 0 && renderedKey.current !== null && renderedKey.current !== settingsKey;

  // Delegates so the de-duplication lives in one place. This used to join the
  // three fields blindly, which pasted the hook and the hashtags twice.
  function buildFullPost(hook: string, body: string, hashtags: string[]) {
    return composePost(hook, body, hashtags);
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
    <div className="bg-white border border-[#F2DAD8] rounded-2xl overflow-hidden hover:border-[#ED383B]/40 transition-all">
      {/* Header */}
      <div className="p-5 pb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-[#ED383B]/[.10] text-[#C9282A] border border-[#ED383B]/20">
          {post.hookCategory}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditing(!editing); setEditHook(post.hook); setEditBody(post.body); }}
            className="p-1.5 rounded-lg text-[#6B5B5A] hover:text-[#C9282A] hover:bg-[#ED383B]/[.10] transition-colors"
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
              <Label className="text-xs text-[#6B5B5A] mb-1">Hook (first 2 lines)</Label>
              <Textarea
                value={editHook}
                onChange={(e) => setEditHook(e.target.value)}
                rows={2}
                className="bg-[#FDF3F2] border-[#F2DAD8] text-[#1A1414] text-sm rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-[#6B5B5A] mb-1">Body</Label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={8}
                className="bg-[#FDF3F2] border-[#F2DAD8] text-[#1A1414] text-sm rounded-xl"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                className="rounded-lg border-[#F2DAD8] text-[#6B5B5A] hover:text-[#1A1414]"
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
          <div className={solo ? "max-w-[620px]" : ""}>
            <LinkedInPreview
              name={userName}
              hook={post.hook}
              body={post.body}
              hashtags={post.hashtags}
              postType={post.postType}
            />
          </div>
        )}
      </div>

      {/* Carousel Slides */}
      {post.carouselSlides && post.carouselSlides.length > 0 && (
        <div className="px-5 mt-3">
          <p className="text-xs text-[#6B5B5A] font-medium mb-2">Carousel Slides ({post.carouselSlides.length})</p>
          <SwipeDeck slideClassName={solo ? "w-[240px]" : "w-[200px]"} label="Carousel slide copy">
            {post.carouselSlides.map((slide, i) => (
              <div
                key={i}
                className="h-full bg-[#FDF3F2] border border-[#F2DAD8] rounded-xl p-3"
              >
                <p className="text-[10px] text-[#C9282A] font-medium mb-1">Slide {slide.slideNumber}</p>
                <p className="text-sm font-bold text-[#1A1414] mb-1 line-clamp-2">{slide.title}</p>
                <p className="text-xs text-[#6B5B5A] line-clamp-3">{slide.body}</p>
              </div>
            ))}
          </SwipeDeck>
        </div>
      )}

      {/* Carousel deck (multi-slide) */}
      {isCarousel && (
        <div className="px-5 mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#6B5B5A] font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#C9282A]" />
              Carousel {carouselImages.length > 0 && <span className="text-[#6B5B5A]">· {carouselImages.length} slides</span>}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-full">
              {/* Render 1-15 slides. Counts above what the model wrote are
                  disabled rather than hidden, so it is clear the ceiling is the
                  deck's own length — rendering cannot invent a slide. Set the
                  higher number on the Format step to get a longer deck. */}
              {slideTotal > 1 && (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] text-[#6B5B5A]">Slides</span>
                  <select
                    value={deckCount}
                    onChange={(e) => setDeckCount(Number(e.target.value))}
                    disabled={carLoading}
                    className="text-[10px] rounded-lg border border-[#F2DAD8] bg-white text-[#1A1414] px-1.5 py-1 font-medium focus:border-[#ED383B] outline-none disabled:opacity-50 [&>option]:bg-white [&>option]:text-[#1A1414]"
                    title="How many slides to render"
                  >
                    <option value={0}>All {slideTotal}</option>
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} disabled={n > slideTotal}>
                        {n}
                        {n > slideTotal ? " — needs a longer deck" : ""}
                      </option>
                    ))}
                  </select>
                </span>
              )}
              {/* Shape picker — tall renders 1080x1350, wide renders 2000x1125.
                  Hidden for Photo, whose size comes from the image style preset. */}
              {deckStyle !== "photo" && (["tall", "wide"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setDeckShape(s)}
                  disabled={carLoading}
                  className={`text-[10px] rounded-lg px-2 py-1 font-medium border disabled:opacity-50 ${
                    deckShape === s
                      ? "border-[#ED383B] text-[#C9282A] bg-[#ED383B]/[.10]"
                      : "border-[#F2DAD8] text-[#6B5B5A]"
                  }`}
                >
                  {s === "tall" ? "4:5" : "16:9"}
                </button>
              ))}
              {/* Style switch — same copy, four visual languages. */}
              {([["swipe", "Minimal"], ["attention", "Bold"], ["editorial", "Colour"], ["koyopo", "Brand"], ["visual", "Visual"], ["campaign", "Campaign"], ["paper", "Paper"], ["photo", "Photo"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setDeckStyle(v)}
                  disabled={carLoading}
                  className={`text-[10px] rounded-lg px-2 py-1 font-medium border disabled:opacity-50 ${
                    deckStyle === v ? "border-[#ED383B] text-[#C9282A] bg-[#ED383B]/[.10]" : "border-[#F2DAD8] text-[#6B5B5A]"
                  }`}
                >
                  {label}
                </button>
              ))}
              {/* Spec-driven styles: one button per row in LAB_STYLES, so the
                  shelf grows without touching this file. */}
              {Object.entries(LAB_STYLES).map(([k, spec]) => (
                <button
                  key={k}
                  onClick={() => setDeckStyle(k)}
                  disabled={carLoading}
                  title={spec.blurb}
                  className={`text-[10px] rounded-lg px-2 py-1 font-medium border disabled:opacity-50 ${
                    deckStyle === k ? "border-[#ED383B] text-[#C9282A] bg-[#ED383B]/[.10]" : "border-[#F2DAD8] text-[#6B5B5A]"
                  }`}
                >
                  {spec.label}
                </button>
              ))}
              {carouselImages.length > 0 && (
                <button
                  onClick={() => setLightbox(0)}
                  className="text-[10px] rounded-lg px-2 py-1 font-medium border border-[#F2DAD8] text-[#1A1414] hover:border-[#ED383B]/50 flex items-center gap-1"
                  title="View the deck full screen"
                >
                  <Maximize2 className="w-3 h-3" /> Expand
                </button>
              )}
              {(deckStyle === "visual" || (deckStyle in LAB_STYLES && LAB_STYLES[deckStyle].imageFit !== "none")) && (
                <button
                  onClick={() => setGenArt(!genArt)}
                  disabled={carLoading}
                  className={`text-[10px] rounded-lg px-2 py-1 font-medium border disabled:opacity-50 ${
                    genArt ? "border-[#EFCB93] text-[#B45309] bg-[#FCE2BA]" : "border-[#F2DAD8] text-[#6B5B5A]"
                  }`}
                  title="Generate an image for slides with no uploaded picture (slow, uses quota)"
                >
                  {genArt ? "AI art on" : "AI art off"}
                </button>
              )}
              {/* Downloads through fetch rather than a bare <a href>. As a link
                  it had no loading state and no error path: a 400 or a 500 put
                  the route's JSON on screen in place of the app. */}
              {/* PDF first: it is what LinkedIn wants for a document post, and
                  it uploads without the re-flow a .pptx goes through. */}
              {(["pdf", "pptx"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => downloadDeck(fmt)}
                  disabled={!!dlBusy || carLoading || carouselImages.length === 0}
                  className={`text-[10px] rounded-lg border px-2 py-1 font-medium disabled:opacity-50 flex items-center gap-1 ${
                    fmt === "pdf"
                      ? "border-[#0A66C2] text-[#0A66C2] hover:bg-[#DCE6F1]"
                      : "border-[#F2DAD8] text-[#1A1414] hover:border-[#ED383B]/50"
                  }`}
                  title={
                    carouselImages.length === 0
                      ? `Render the deck first — the .${fmt} is built from the slides on screen`
                      : deckStale
                        ? "Downloads the deck as currently rendered — apply your changes first to include them"
                        : fmt === "pdf"
                          ? "Download as PDF — the format LinkedIn accepts for a document post"
                          : "Download these slides as a PowerPoint deck"
                  }
                >
                  {dlBusy === fmt ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {dlBusy === fmt ? "Building…" : `.${fmt}`}
                </button>
              ))}
              <button
                onClick={generateCarousel}
                disabled={carLoading}
                className="text-[11px] rounded-lg bg-[#ED383B] text-white px-2.5 py-1 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {carLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {carouselImages.length === 0 ? "Render deck" : deckStale ? "Apply changes" : "Re-render"}
              </button>
            </div>
          </div>
          {carLoading ? (
            <div className="rounded-xl border border-[#F2DAD8] bg-[#FDF3F2] aspect-[4/5] flex items-center justify-center">
              <div className="text-center px-4">
                <Loader2 className="w-7 h-7 text-[#C9282A] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#6B5B5A]">Designing your carousel slides…</p>
                <p className="text-[10px] text-[#6B5B5A] mt-0.5">
                  {deckStyle === "photo"
                    ? "Gathos / Gemini · ~40–90s"
                    : deckStyle === "visual" && genArt
                      ? "One image per slide · this takes minutes"
                      : "Local render · a few seconds"}
                </p>
              </div>
            </div>
          ) : carouselImages.length > 0 ? (
            <>
              {deckStale && (
                <p className="text-[11px] text-[#C9282A] bg-[#ED383B]/[.10] border border-[#ED383B]/30 rounded-lg px-2.5 py-1.5 mb-2">
                  Settings changed — press <span className="font-semibold">Apply changes</span> to re-render.
                </p>
              )}
            <SwipeDeck slideClassName={solo ? "w-[210px] sm:w-[240px]" : "w-[190px] sm:w-[220px]"} label="Carousel slides">
              {carouselImages.map((url, i) => (
                <div
                  key={i}
                  onClick={() => setLightbox(i)}
                  className="relative rounded-xl overflow-hidden border border-[#F2DAD8] bg-[#FDF3F2] cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-auto select-none pointer-events-none" draggable={false} />
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/60 text-[#1A1414]">
                    {i + 1}/{carouselImages.length}
                  </span>
                  <a href={url} download className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur border border-[#F2DAD8] flex items-center justify-center text-[#1A1414] hover:bg-black/70">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </SwipeDeck>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#F2DAD8] bg-[#FDF3F2] p-6 text-center">
              <Layers className="w-7 h-7 text-[#6B5B5A] mx-auto mb-2" />
              <p className="text-xs text-[#6B5B5A]">{carError || "No carousel yet"}</p>
              <button onClick={generateCarousel} className="mt-2 text-xs text-[#C9282A] hover:text-[#8E1B18] font-medium">
                Generate carousel slides
              </button>
            </div>
          )}
        </div>
      )}

      {/* Standalone image — text/article/poll only. A carousel is a document
          post and takes ONE upload, so its visual belongs inside the deck: use
          the "Photo" deck style above. */}
      {!isCarousel && (
      <div className="px-5 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[#6B5B5A] font-medium flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#C9282A]" />
            Premium Image
            {imgStyleName && <span className="text-[#6B5B5A]">· {imgStyleName}</span>}
          </p>
          <select
            value={imgStyle}
            onChange={(e) => generateImage(e.target.value)}
            disabled={imgLoading}
            className="text-[11px] rounded-lg bg-[#FDF3F2] border border-[#F2DAD8] text-[#1A1414] px-2 py-1 focus:border-[#ED383B] outline-none disabled:opacity-50 max-w-[160px]"
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

        <div className={`relative rounded-xl overflow-hidden border border-[#F2DAD8] bg-[#FDF3F2] aspect-[4/5] flex items-center justify-center ${solo ? "max-w-[520px]" : ""}`}>
          {imgLoading ? (
            <div className="text-center px-4">
              <Loader2 className="w-7 h-7 text-[#C9282A] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#6B5B5A]">Designing your premium visual…</p>
              <p className="text-[10px] text-[#6B5B5A] mt-0.5">Gathos / Gemini · ~20–60s</p>
            </div>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Generated premium visual" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center px-4">
              <div className="flex justify-center mb-3"><AccentIcon icon={Wand2} accent="amber" size="xl" glow /></div>
              <p className="text-xs text-[#6B5B5A]">{imgError || "No image yet"}</p>
              <button
                onClick={() => generateImage(imgStyle)}
                className="mt-2 text-xs text-[#C9282A] hover:text-[#8E1B18] font-medium"
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
                className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur border border-[#F2DAD8] flex items-center justify-center text-[#1A1414] hover:bg-black/70 transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => generateImage(imgStyle)}
                className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur border border-[#F2DAD8] flex items-center justify-center text-[#1A1414] hover:bg-black/70 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {lightbox !== null && carouselImages.length > 0 && (
        <DeckLightbox
          images={carouselImages}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
          label={`Carousel for "${post.hook.slice(0, 40)}"`}
        />
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
              className="text-xs text-[#6B5B5A] hover:text-[#1A1414] transition-colors"
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
                className="w-full h-10 bg-[#FDF3F2] hover:bg-[#FDF3F2]/70 border border-[#F2DAD8] text-[#1A1414] font-medium rounded-xl gap-2 disabled:opacity-50"
              >
                {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Post Now
              </Button>
              <Button
                onClick={() => setSchedOpen((v) => !v)}
                disabled={statusBusy}
                className="w-full h-10 bg-[#FDF3F2] hover:bg-[#FDF3F2]/70 border border-[#F2DAD8] text-[#1A1414] font-medium rounded-xl gap-2 disabled:opacity-50"
              >
                <CalendarIcon className="w-4 h-4" />
                Schedule
              </Button>
            </div>
            {schedOpen && (
              <div className="rounded-xl bg-[#FDF3F2] border border-[#F2DAD8] p-3 space-y-2.5">
                <p className="text-xs text-[#6B5B5A] font-medium">Pick a date & time — it lands on your Calendar.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-[#F2DAD8] bg-white text-[#1A1414] outline-none focus:border-[#ED383B]"
                  />
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="text-xs px-2.5 py-2 rounded-lg border border-[#F2DAD8] bg-white text-[#1A1414] outline-none focus:border-[#ED383B]"
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
          className="flex items-center gap-1.5 text-xs text-[#6B5B5A] hover:text-[#1A1414] transition-colors w-full justify-center"
          onClick={() => setExpanded(!expanded)}
        >
          Why this works
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <p className="text-xs text-[#6B5B5A] leading-relaxed bg-[#FDF3F2] rounded-xl p-3 border border-[#F2DAD8]">
            {post.whyThisWorks}
          </p>
        )}

        {/* Variations */}
        {post.variations && post.variations.length > 0 && (
          <>
            <button
              className="flex items-center gap-1.5 text-xs text-[#C9282A] hover:text-[#8E1B18] transition-colors w-full justify-center font-medium"
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
                    className="bg-[#FDF3F2] border border-[#F2DAD8] rounded-xl p-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[#1A1414] leading-relaxed whitespace-pre-line flex-1">
                        {v}
                      </p>
                      <button
                        onClick={() => copyToClipboard(v, i)}
                        className="shrink-0 p-1.5 rounded-lg text-[#6B5B5A] hover:text-[#C9282A] hover:bg-[#ED383B]/[.10] transition-colors"
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

/** The blank form. Kept as one object so the initial state and the reset cannot
 *  drift apart — they read from the same place. */
const BLANK_FORM = {
  topic: "",
  postType: "text" as PostType,
  postsCount: 3,
  slidesCount: 0,
  targetAudience: "",
  tone: "",
  customInstructions: "",
  // "" = no style-specific direction, which is the previous behaviour exactly.
  deckStyle: "",
};

/** Only the two styles whose COPY differs. Everything else renders as before. */
const COPY_STYLES: { value: string; label: string; blurb: string }[] = [
  { value: "", label: "No preference", blurb: "The deck type is chosen per post, as before." },
  { value: "walkthrough", label: "Walkthrough", blurb: "Ordered steps, named components, the decision and the failure mode at each one." },
  { value: "campaign", label: "Campaign", blurb: "A before, a turn and an after — narrative and first-person, authority from what it cost." },
];

export default function CreatePage() {
  const [step, setStep] = useState<Step>("form");
  const [topic, setTopic] = useState(BLANK_FORM.topic);
  const [postType, setPostType] = useState<PostType>(BLANK_FORM.postType);
  const [postsCount, setPostsCount] = useState(BLANK_FORM.postsCount);
  // Slides per carousel. 0 = let the model choose (8-10, the benchmark range).
  const [slidesCount, setSlidesCount] = useState(BLANK_FORM.slidesCount);
  const [genDeckStyle, setGenDeckStyle] = useState(BLANK_FORM.deckStyle);
  // Optional: source files the post should be built from, and free-text
  // direction on what the client wants back. Both are additive — leaving them
  // empty gives exactly the previous behaviour.
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [customInstructions, setCustomInstructions] = useState(BLANK_FORM.customInstructions);
  const refInput = useRef<HTMLInputElement>(null);
  const [targetAudience, setTargetAudience] = useState(BLANK_FORM.targetAudience);
  const [tone, setTone] = useState(BLANK_FORM.tone);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  // Set from ResumeOnboarding once a profile exists (freshly uploaded or already
  // saved), which is what unlocks step 2.
  const [profileReady, setProfileReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  /**
   * "Create More" used to reset only step, posts and batchId — so the wizard
   * came back holding the previous brief: the same topic, the same audience,
   * the same tone and slide count, at whatever step it was left on. The next
   * post was being written from the last one's inputs unless the user noticed
   * and cleared each field by hand.
   */
  function startNewPost() {
    setStep("form");
    setPosts([]);
    setBatchId(null);
    setTopic(BLANK_FORM.topic);
    setPostType(BLANK_FORM.postType);
    setPostsCount(BLANK_FORM.postsCount);
    setSlidesCount(BLANK_FORM.slidesCount);
    setGenDeckStyle(BLANK_FORM.deckStyle);
    setTargetAudience(BLANK_FORM.targetAudience);
    setTone(BLANK_FORM.tone);
    setCustomInstructions(BLANK_FORM.customInstructions);
    setRefFiles([]);
    // The file input keeps its own DOM value, so clearing the array is not
    // enough — re-picking the same file would otherwise fire no change event.
    if (refInput.current) refInput.current.value = "";
    // The resume is already built by this point, so step 1 has nothing to do.
    setWizardStep(profileReady ? 2 : 1);
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }
    setSubmitting(true);

    try {
      const fields: Record<string, string> = {
        topic: topic.trim(),
        postType,
        postsCount: String(postsCount),
      };
      if (targetAudience) fields.targetAudience = targetAudience;
      if (tone) fields.tonePrefs = tone;
      if (postType === "carousel" && slidesCount) fields.slidesCount = String(slidesCount);
      if (postType === "carousel" && genDeckStyle) fields.deckStyle = genDeckStyle;
      if (customInstructions.trim()) fields.customInstructions = customInstructions.trim();

      // Multipart only when there is a file to carry — JSON stays the common
      // path and keeps the request small.
      let res: Response;
      if (refFiles.length) {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        refFiles.forEach((f) => fd.append("reference", f));
        res = await fetch("/api/generate", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
      }

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
    const canAdvance =
      wizardStep === 1 ? profileReady :
      wizardStep === 2 ? topic.trim().length > 0 :
      true;

    return (
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1A1414] tracking-tight">Create LinkedIn Post</h1>
          <p className="text-[#6B5B5A] text-sm mt-1">{WIZARD_STEPS[wizardStep - 1].blurb}</p>
        </div>


        {/* Progress rail — completed steps stay clickable so nothing is a dead end. */}
        <div className="flex items-center gap-2 mb-8">
          {WIZARD_STEPS.map((s, i) => {
            const done = wizardStep > s.n;
            const active = wizardStep === s.n;
            return (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => { if (wizardStep > s.n) setWizardStep(s.n); }}
                  disabled={wizardStep <= s.n}
                  className={`flex items-center gap-2 ${wizardStep > s.n ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 transition-colors ${
                      done
                        ? "bg-[#ED383B]/20 text-[#C9282A] border border-[#ED383B]"
                        : active
                          ? "bg-[#ED383B] text-white"
                          : "bg-white text-[#6B5B5A] border border-[#F2DAD8]"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : s.n}
                  </span>
                  <span className={`text-xs font-medium hidden sm:inline ${active ? "text-[#1A1414]" : done ? "text-[#1A1414]" : "text-[#6B5B5A]"}`}>
                    {s.label}
                  </span>
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <span className={`h-px flex-1 ${wizardStep > s.n ? "bg-[#ED383B]/50" : "bg-[#FAE8E6]"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* The form NEVER submits itself. Choosing a file in the OS dialog can
            land the closing Enter keypress on the form, and any stray Enter in a
            text field would do the same — both fired a generation the user never
            asked for. Generation happens on one path only: clicking Generate. */}
        <form
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault();
          }}
          className="space-y-6"
        >
          {/* STEP 1 — Resume. Every post is written from this, so it comes first. */}
          {wizardStep === 1 && (
            <div className="space-y-3">
              <ResumeOnboarding
                onProfileReady={(p) => setProfileReady(!!p)}
                onUseIdea={(idea) => { setTopic(idea); setWizardStep(2); }}
              />
              {!profileReady && (
                <p className="text-xs text-[#6B5B5A]">
                  Upload your CV or paste your background above. Posts written from your real
                  experience beat generic advice — this is what makes them yours.
                </p>
              )}
            </div>
          )}

          {/* STEP 2 — Topic */}
          {wizardStep === 2 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#1A1414]">
                What do you want to post about? <span className="text-red-400">*</span>
              </Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. I quantized a YOLOv8 detector to ONNX FP16 expecting to lose accuracy. mAP went from 0.6637 to 0.6642. Why edge deployment is less painful than engineers assume."
                rows={5}
                autoFocus
                className="bg-white border-[#F2DAD8] text-[#1A1414] placeholder:text-[#6B5B5A] rounded-xl text-sm focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B]"
              />
              <p className="text-xs text-[#6B5B5A]">
                Be specific. A real number, a real failure, or a claim someone could argue with
                beats a broad topic every time.
              </p>
            </div>
          )}

          {/* STEP 3 — Format */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1A1414]">Post Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {POST_TYPES.map((pt) => {
                    const a = ACCENTS[pt.accent];
                    const on = postType === pt.value;
                    return (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => setPostType(pt.value)}
                        className="flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left bg-white"
                        style={on ? { borderColor: a.fg, background: a.tint } : { borderColor: "#F2DAD8" }}
                      >
                        <pt.icon className="w-5 h-5 mt-0.5 shrink-0" style={{ color: on ? a.fg : "#6B5B5A" }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: on ? a.fg : "#1A1414" }}>
                            {pt.label}
                          </p>
                          <p className="text-xs text-[#6B5B5A] mt-0.5">{pt.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1A1414]">Number of Posts</Label>
                <div className="flex gap-2">
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPostsCount(n)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        postsCount === n
                          ? "bg-[#ED383B] text-white shadow-lg shadow-[#ED383B]/25"
                          : "bg-white text-[#6B5B5A] border border-[#F2DAD8] hover:border-[#ED383B]/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#6B5B5A]">
                  Each post also comes with 3 alternative versions, so {postsCount} gives you {postsCount * 4} to choose from.
                </p>
              </div>

              {/* Slides per deck. Only the generator can create slides, so this
                  belongs here rather than on the rendered deck — the render-time
                  control can trim a deck but never extend one. */}
              {/* Deck style is normally picked AFTER generation, where it only
                  changes how the words are drawn. These two want different words,
                  so they are chosen here instead — before anything is written. */}
              {postType === "carousel" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1A1414]">Write for a deck style</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COPY_STYLES.map((cs) => (
                      <button
                        key={cs.value || "none"}
                        type="button"
                        onClick={() => setGenDeckStyle(cs.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                          genDeckStyle === cs.value
                            ? "bg-[#ED383B] text-white border-[#ED383B]"
                            : "bg-white text-[#6B5B5A] border-[#F2DAD8] hover:border-[#ED383B]/50"
                        }`}
                      >
                        {cs.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#6B5B5A]">
                    {COPY_STYLES.find((c) => c.value === genDeckStyle)?.blurb}
                  </p>
                </div>
              )}

              {postType === "carousel" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1A1414]">Slides per carousel</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSlidesCount(0)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        slidesCount === 0
                          ? "bg-[#ED383B] text-white shadow-lg shadow-[#ED383B]/25"
                          : "bg-white text-[#6B5B5A] border border-[#F2DAD8] hover:border-[#ED383B]/50"
                      }`}
                    >
                      Auto
                    </button>
                    {Array.from({ length: 13 }, (_, i) => i + 3).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSlidesCount(n)}
                        className={`w-10 py-2 rounded-xl text-sm font-medium transition-all ${
                          slidesCount === n
                            ? "bg-[#ED383B] text-white shadow-lg shadow-[#ED383B]/25"
                            : "bg-white text-[#6B5B5A] border border-[#F2DAD8] hover:border-[#ED383B]/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#6B5B5A]">
                    {slidesCount === 0
                      ? "Auto picks 8–10, where completion rates peak."
                      : slidesCount > 12
                        ? `${slidesCount} slides. Completion drops off past 12 — worth it only if every slide carries real material.`
                        : `${slidesCount} slides: a cover, ${slidesCount - 2} content slide${slidesCount - 2 === 1 ? "" : "s"}, and a closing CTA.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Details */}
          {wizardStep === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1A1414]">Target Audience</Label>
                  <Input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. AI/ML engineers and hiring managers in India"
                    className="bg-white border-[#F2DAD8] text-[#1A1414] placeholder:text-[#6B5B5A] rounded-xl h-10 text-sm focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1A1414]">Tone &amp; Style</Label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(tone === t ? "" : t)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                        tone === t
                          ? "bg-[#ED383B] text-white"
                          : "bg-white text-[#6B5B5A] border border-[#F2DAD8] hover:border-[#ED383B]/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional source material. A client often already has the
                  substance — a report, a deck, a chart, a photo of a whiteboard.
                  Gemini reads PDFs and images natively, so the file goes into
                  the request as-is and becomes the primary source. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1A1414]">
                  Reference file <span className="text-[#6B5B5A] font-normal">(optional)</span>
                </Label>
                <div
                  onClick={() => refInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = Array.from(e.dataTransfer.files || []);
                    if (f.length) setRefFiles((prev) => [...prev, ...f].slice(0, MAX_REF_FILES));
                  }}
                  className="border-2 border-dashed border-[#F2DAD8] hover:border-[#ED383B]/50 rounded-xl p-4 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={refInput}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = Array.from(e.target.files || []);
                      if (f.length) setRefFiles((prev) => [...prev, ...f].slice(0, MAX_REF_FILES));
                    }}
                  />
                  <FileText className="w-5 h-5 text-[#6B5B5A] mx-auto mb-1" />
                  <p className="text-xs text-[#1A1414] font-medium">Build the post from a file</p>
                  <p className="text-[11px] text-[#6B5B5A] mt-0.5">
                    PDF, image, or doc · up to {MAX_REF_FILES} files · select or drop several at once
                  </p>
                </div>
                {refFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {refFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-[#FDF3F2] border border-[#F2DAD8] rounded-lg px-3 py-2">
                        <FileText className="w-3.5 h-3.5 text-[#C9282A] shrink-0" />
                        <span className="text-[#1A1414] truncate flex-1">{f.name}</span>
                        <span className="text-[#6B5B5A] shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          onClick={() => setRefFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="text-[#6B5B5A] hover:text-[#C9282A] shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <p className="text-[11px] text-[#6B5B5A]">
                      The file becomes the primary source — figures and findings come from it, not from guesswork.
                    </p>
                  </div>
                )}
              </div>

              {/* Free-text direction. Overrides the built-in defaults, which is
                  what makes the same engine produce different work per client. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#1A1414]">
                  Describe the output you want <span className="text-[#6B5B5A] font-normal">(optional)</span>
                </Label>
                <Textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. Make slide 1 a bold contrarian claim. Keep every slide under 25 words. Use the numbers from the attached report. End with a CTA to download the template. No emojis."
                  className="bg-white border-[#F2DAD8] text-[#1A1414] placeholder:text-[#6B5B5A] rounded-xl text-sm focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B]"
                />
                <p className="text-xs text-[#6B5B5A]">
                  These instructions override the defaults — structure, length, tone, what to emphasise, what to avoid.
                </p>
              </div>

              {/* Recap, so the earlier steps can be checked without navigating back. */}
              <div className="rounded-xl border border-[#F2DAD8] bg-[#FDF3F2] p-4 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wider text-[#6B5B5A] font-semibold">Ready to generate</p>
                <p className="text-xs text-[#1A1414] line-clamp-2">
                  <span className="text-[#6B5B5A]">Topic:</span> {topic || "—"}
                </p>
                <p className="text-xs text-[#1A1414]">
                  <span className="text-[#6B5B5A]">Format:</span>{" "}
                  {POST_TYPES.find((p) => p.value === postType)?.label} · {postsCount} post{postsCount !== 1 ? "s" : ""}
                  {postType === "carousel" && slidesCount ? ` · ${slidesCount} slides` : ""}
                </p>
                {(refFiles.length > 0 || customInstructions.trim()) && (
                  <p className="text-xs text-[#1A1414]">
                    <span className="text-[#6B5B5A]">Source:</span>{" "}
                    {refFiles.length > 0 ? `${refFiles.length} file${refFiles.length !== 1 ? "s" : ""}` : "—"}
                    {customInstructions.trim() ? " · custom direction" : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            {wizardStep > 1 && (
              <Button
                type="button"
                onClick={() => setWizardStep((s) => (s - 1) as WizardStep)}
                className="h-12 px-5 bg-white hover:bg-[#FAE8E6] text-[#1A1414] font-medium rounded-xl border border-[#F2DAD8]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}

            {wizardStep < 4 ? (
              <Button
                type="button"
                onClick={() => {
                  if (!canAdvance) {
                    toast.error(wizardStep === 1 ? "Add your resume first" : "Tell us what the post is about");
                    return;
                  }
                  setWizardStep((s) => (s + 1) as WizardStep);
                }}
                className="flex-1 h-12 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl text-base gap-2 shadow-lg shadow-[#ED383B]/25"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="flex-1 h-12 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl text-base gap-2 shadow-lg shadow-[#ED383B]/25 disabled:opacity-50"
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
            )}
          </div>

          {/* Step 1 is gated on the resume, but never trap someone who has not got one. */}
          {wizardStep === 1 && !profileReady && (
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className="w-full text-xs text-[#6B5B5A] hover:text-[#6B5B5A] underline underline-offset-4"
            >
              Skip for now — posts will be more generic without it
            </button>
          )}
        </form>
      </div>
    );
  }

  // ── GENERATING (loading state) ──
  if (step === "generating") {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-[#ED383B]/[.10] border border-[#ED383B]/20 flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-[#C9282A] animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-[#1A1414] mb-2">Generating your LinkedIn posts...</h2>
        <p className="text-[#6B5B5A] text-sm">This usually takes 15-30 seconds. Our AI is crafting scroll-stopping content.</p>
      </div>
    );
  }

  // ── DONE ──
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1414] tracking-tight">
            {posts.length} LinkedIn Post{posts.length !== 1 ? "s" : ""} Ready!
          </h1>
          <p className="text-[#6B5B5A] text-sm mt-1">
            Review your posts, edit if needed, then copy and paste into LinkedIn.
          </p>
        </div>
        <button
          onClick={startNewPost}
          className="flex items-center gap-2 text-sm text-[#6B5B5A] hover:text-[#1A1414] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Create More
        </button>
      </div>

      {/* Post Grid */}
      {/* The grid follows the batch size. One post in a two-column grid left
          half the screen empty; three posts in a single column wastes a wide
          monitor. */}
      <div
        className={
          posts.length === 1
            ? "grid grid-cols-1 gap-6"
            : posts.length === 2
              ? "grid grid-cols-1 lg:grid-cols-2 gap-6"
              : "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6"
        }
      >
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} userName="You" index={i} />
        ))}
      </div>
    </div>
  );
}
