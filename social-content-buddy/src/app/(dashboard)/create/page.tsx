"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Download,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  CheckCircle2,
  ArrowLeft,
  Globe,
  Users,
  MessageSquare,
  Hash,
  Send,
  Clock,
  Calendar,
  Pencil,
  Check,
  X,
  Upload,
  Package,
  FolderOpen,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "form" | "generating" | "done";

interface GeneratedPost {
  id: string;
  status: "pending" | "generating" | "completed" | "failed";
  imageUrl?: string | null;
  hookCategory?: string | null;
  captionHook?: string | null;
  captionBody?: string | null;
  hashtags?: string[] | null;
  captionVariations?: string[] | null;
  designBrief?: string | null;
  whyThisWorks?: string | null;
  publishedAt?: string | null;
  scheduledAt?: string | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  accountId: string;
  username: string | null;
}

function PostSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="aspect-square bg-slate-100 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/60 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-3.5 bg-slate-100 rounded-lg w-1/3 animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 rounded-lg w-full animate-pulse" />
          <div className="h-3 bg-slate-100 rounded-lg w-4/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  showPublish,
  accounts,
  onPublished,
  onScheduled,
  onEdited,
}: {
  post: GeneratedPost;
  showPublish?: boolean;
  accounts?: SocialAccount[];
  onPublished?: (postId: string) => void;
  onScheduled?: (postId: string, scheduledAt: string) => void;
  onEdited?: (postId: string, field: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [actionMode, setActionMode] = useState<"idle" | "publish" | "schedule">("idle");
  const [scheduleDate, setScheduleDate] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveEdit(field: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue }),
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          toast.error(data.error || "Failed to save");
        } catch {
          toast.error("Failed to save");
        }
        return;
      }
      onEdited?.(post.id, field, editValue);
      toast.success("Updated");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingEdit(false);
      setEditingField(null);
    }
  }

  async function handlePublish(accountId: string) {
    setPublishing(true);
    try {
      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, accountId }),
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          toast.error(data.error || "Failed to publish");
        } catch {
          toast.error("Failed to publish");
        }
        return;
      }
      toast.success("Post published to Instagram!");
      onPublished?.(post.id);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPublishing(false);
      setActionMode("idle");
    }
  }

  async function handleSchedule(accountId: string) {
    if (!scheduleDate) {
      toast.error("Please select a date and time");
      return;
    }
    const scheduledAt = new Date(scheduleDate);
    if (scheduledAt <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }
    setScheduling(true);
    try {
      const res = await fetch("/api/posts/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          accountId,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          toast.error(data.error || "Failed to schedule");
        } catch {
          toast.error("Failed to schedule");
        }
        return;
      }
      toast.success("Post scheduled!");
      onScheduled?.(post.id, scheduledAt.toISOString());
    } catch {
      toast.error("Something went wrong");
    } finally {
      setScheduling(false);
      setActionMode("idle");
      setScheduleDate("");
    }
  }

  // Get default schedule time: next hour, rounded up
  function getDefaultScheduleMin() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toISOString().slice(0, 16);
  }

  if (post.status === "pending" || post.status === "generating") {
    return <PostSkeleton />;
  }

  if (post.status === "failed") {
    return (
      <div className="rounded-2xl bg-white border border-red-200 overflow-hidden shadow-sm">
        <div className="aspect-square bg-red-50 flex items-center justify-center">
          <div className="text-center space-y-2 p-6">
            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-red-500 text-sm font-medium">Generation failed</p>
          </div>
        </div>
      </div>
    );
  }

  const isActionable = post.status === "completed" && !post.publishedAt && !post.scheduledAt;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-violet-300 transition-all duration-200 group shadow-sm">
      <div className="aspect-square relative bg-slate-100">
        {post.imageUrl ? (
          <Image
            src={post.imageUrl}
            alt={post.captionHook || "Generated post"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-slate-300" />
          </div>
        )}
        {/* Download overlay */}
        {post.imageUrl && (
          <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={() => window.open(post.imageUrl!, "_blank")}
              className="flex items-center gap-2 bg-white/90 hover:bg-white text-slate-900 text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Hook Category — editable */}
        {post.hookCategory && (
          editingField === "hookCategory" ? (
            <div className="flex items-center gap-1.5">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-lg border border-violet-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 flex-1"
                autoFocus
              />
              <button onClick={() => saveEdit("hookCategory")} disabled={savingEdit} className="text-violet-600 hover:text-violet-700 cursor-pointer">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditingField(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/hook">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200">
                <Hash className="w-3 h-3" />
                {post.hookCategory}
              </span>
              {showPublish && (
                <button
                  onClick={() => { setEditingField("hookCategory"); setEditValue(post.hookCategory || ""); }}
                  className="opacity-0 group-hover/hook:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        )}

        {/* Caption — editable */}
        {post.captionHook && (
          editingField === "captionHook" ? (
            <div className="space-y-1.5">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                className="w-full text-sm px-3 py-2 rounded-lg border border-violet-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setEditingField(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-0.5">Cancel</button>
                <button onClick={() => saveEdit("captionHook")} disabled={savingEdit} className="text-xs text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50">
                  {savingEdit ? "..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 group/caption">
              <p className="text-slate-900 text-sm font-medium leading-snug line-clamp-3 flex-1">
                {post.captionHook}
              </p>
              {showPublish && (
                <button
                  onClick={() => { setEditingField("captionHook"); setEditValue(post.captionHook || ""); }}
                  className="opacity-0 group-hover/caption:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        )}

        {/* Caption Body — editable */}
        {post.captionBody && (
          editingField === "captionBody" ? (
            <div className="space-y-1.5">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                className="w-full text-xs px-3 py-2 rounded-lg border border-violet-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setEditingField(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-0.5">Cancel</button>
                <button onClick={() => saveEdit("captionBody")} disabled={savingEdit} className="text-xs text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50">
                  {savingEdit ? "..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 group/body">
              <p className="text-slate-600 text-xs leading-relaxed flex-1 line-clamp-4">
                {post.captionBody}
              </p>
              {showPublish && (
                <button
                  onClick={() => { setEditingField("captionBody"); setEditValue(post.captionBody || ""); }}
                  className="opacity-0 group-hover/body:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        )}

        {/* Hashtags */}
        {post.hashtags && Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
          editingField === "hashtags" ? (
            <div className="space-y-1.5">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                placeholder="One hashtag per line, e.g. #coffee"
                className="w-full text-xs px-3 py-2 rounded-lg border border-violet-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none font-mono"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setEditingField(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-0.5">Cancel</button>
                <button
                  onClick={() => {
                    const tags = editValue.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
                    // Save as array via custom handler
                    setSavingEdit(true);
                    fetch(`/api/posts/${post.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ hashtags: tags }),
                    }).then(r => {
                      if (r.ok) { onEdited?.(post.id, "hashtags", tags.join(" ")); toast.success("Updated"); }
                      else toast.error("Failed to save");
                    }).catch(() => toast.error("Something went wrong"))
                    .finally(() => { setSavingEdit(false); setEditingField(null); });
                  }}
                  disabled={savingEdit}
                  className="text-xs text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? "..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 group/tags">
              <div className="flex flex-wrap gap-1 flex-1">
                {(post.hashtags as string[]).slice(0, 8).map((tag, i) => (
                  <span key={i} className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">
                    {tag}
                  </span>
                ))}
                {(post.hashtags as string[]).length > 8 && (
                  <span className="text-[10px] text-slate-400">+{(post.hashtags as string[]).length - 8}</span>
                )}
              </div>
              {showPublish && (
                <button
                  onClick={() => { setEditingField("hashtags"); setEditValue((post.hashtags as string[]).join("\n")); }}
                  className="opacity-0 group-hover/tags:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        )}

        {/* Caption Variations */}
        {showPublish && post.captionVariations && Array.isArray(post.captionVariations) && post.captionVariations.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Variations</p>
            <div className="space-y-1">
              {(post.captionVariations as string[]).map((v, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setEditingField("captionHook");
                    setEditValue(v);
                    // Auto-save the variation
                    saveEdit("captionHook");
                  }}
                  className="w-full text-left text-xs text-slate-500 hover:text-violet-700 hover:bg-violet-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer line-clamp-2 border border-transparent hover:border-violet-200"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Why this works — editable */}
        {post.whyThisWorks && (
          <>
            <button
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              onClick={() => setExpanded(!expanded)}
            >
              Why this works
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
              editingField === "whyThisWorks" ? (
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-violet-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => setEditingField(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-0.5">Cancel</button>
                    <button onClick={() => saveEdit("whyThisWorks")} disabled={savingEdit} className="text-xs text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50">
                      {savingEdit ? "..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 group/why border-t border-slate-100 pt-3">
                  <p className="text-slate-500 text-xs leading-relaxed flex-1">
                    {post.whyThisWorks}
                  </p>
                  {showPublish && (
                    <button
                      onClick={() => { setEditingField("whyThisWorks"); setEditValue(post.whyThisWorks || ""); }}
                      className="opacity-0 group-hover/why:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity mt-0.5 shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            )}
          </>
        )}

        {/* ── Publish / Schedule actions ── */}
        {showPublish && isActionable && (
          <div className="mt-2 space-y-2">
            {actionMode === "idle" && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!accounts || accounts.length === 0) {
                      toast.error("Connect an Instagram account in Settings first");
                      return;
                    }
                    setActionMode("publish");
                  }}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-1.5 text-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publish Now
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!accounts || accounts.length === 0) {
                          toast.error("Connect an Instagram account in Settings first");
                          return;
                        }
                      }}
                      className="rounded-xl gap-1.5 text-sm cursor-pointer border-slate-300 text-slate-700 hover:border-violet-300 hover:bg-violet-50"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Schedule
                    </Button>
                  </PopoverTrigger>
                  {accounts && accounts.length > 0 && (
                    <PopoverContent className="w-72 p-4" align="end">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-violet-600" />
                          <p className="text-sm font-medium text-slate-900">Schedule Post</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-500 font-medium">Date & Time</label>
                          <input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={getDefaultScheduleMin()}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-500 font-medium">Account</label>
                          {accounts.map((acc) => (
                            <button
                              key={acc.accountId}
                              onClick={() => handleSchedule(acc.accountId)}
                              disabled={scheduling || !scheduleDate}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {scheduling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-violet-600" />
                              )}
                              @{acc.username || "Instagram"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
              </div>
            )}

            {/* Account selector for Publish Now */}
            {actionMode === "publish" && accounts && accounts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 font-medium">Publish to:</p>
                {accounts.map((acc) => (
                  <button
                    key={acc.accountId}
                    onClick={() => handlePublish(acc.accountId)}
                    disabled={publishing}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {publishing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-violet-600" />
                    )}
                    @{acc.username || "Instagram"}
                  </button>
                ))}
                <button
                  onClick={() => setActionMode("idle")}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Published badge */}
        {post.publishedAt && (
          <div className="flex items-center gap-2 mt-2 text-emerald-600 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Published
          </div>
        )}

        {/* Scheduled badge */}
        {post.scheduledAt && !post.publishedAt && (
          <div className="flex items-center gap-2 mt-2 text-amber-600 text-sm font-medium">
            <Clock className="w-4 h-4" />
            Scheduled for {new Date(post.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tonePrefs, setTonePrefs] = useState("");
  const [postsCount, setPostsCount] = useState("3");

  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<Array<{ id: string; url: string; filename: string }>>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);

  // Pre-fill from active workspace
  const lastWsId = useRef<string | null>(null);
  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id !== lastWsId.current && step === "form") {
      lastWsId.current = activeWorkspace.id;
      setBusinessName(activeWorkspace.businessName || "");
      setWebsiteUrl(activeWorkspace.websiteUrl || "");
      setTargetAudience(activeWorkspace.targetAudience || "");
      setTonePrefs(activeWorkspace.tonePrefs || "");
    }
  }, [activeWorkspace, step]);

  const totalCount = posts.length || parseInt(postsCount, 10);
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const completedCount = posts.filter((p) => p.status === "completed").length;
  const failedCount = posts.filter((p) => p.status === "failed").length;

  // Fetch social accounts for publishing
  useEffect(() => {
    fetch("/api/user/social-accounts")
      .then((r) => r.ok ? r.json() : [])
      .then(setSocialAccounts)
      .catch(() => {});
  }, []);

  // SSE stream
  useEffect(() => {
    if (step !== "generating" || !batchId) return;

    let cancelled = false;
    const controller = new AbortController();

    async function readStream() {
      let response: Response;
      try {
        response = await fetch(`/api/generate/stream/${batchId}`, {
          signal: controller.signal,
        });
      } catch {
        if (!cancelled) toast.error("Failed to connect to generation stream.");
        return;
      }

      if (!response.ok || !response.body) {
        toast.error("Generation stream unavailable.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "post_completed") {
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === event.post.id ? { ...event.post, status: "completed" as const } : p
                  )
                );
                setDoneCount((n) => n + 1);
              }
              if (event.type === "post_failed") {
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === event.postId ? { ...p, status: "failed" as const } : p
                  )
                );
                setDoneCount((n) => n + 1);
              }
              if (event.type === "batch_done") {
                setStep("done");
                if (event.failed === 0) {
                  toast.success(`All ${event.completed} posts generated!`);
                } else {
                  toast.warning(`${event.completed} posts done, ${event.failed} failed.`);
                }
              }
              if (event.type === "error") {
                toast.error("Generation error: " + event.message);
              }
            } catch {
              // malformed event
            }
          }
        }
      } catch {
        if (!cancelled) toast.error("Stream connection lost.");
      } finally {
        reader.releaseLock();
      }
    }

    readStream();
    return () => { cancelled = true; controller.abort(); };
  }, [step, batchId]);

  async function handleProductUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Only PNG, JPG, and WebP images are allowed");
      return;
    }
    setUploadingProduct(true);
    setProductPreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "product");

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        toast.error(data.error || "Failed to upload image");
        setProductPreview(null);
        return;
      }

      const { url } = await res.json();
      setProductImageUrl(url);
      toast.success("Product photo uploaded");
    } catch {
      toast.error("Something went wrong");
      setProductPreview(null);
    } finally {
      setUploadingProduct(false);
    }
  }

  function removeProduct() {
    setProductImageUrl(null);
    setProductPreview(null);
  }

  const openMediaPicker = useCallback(async () => {
    if (!activeWorkspace) return;
    setShowMediaPicker(true);
    setLoadingMedia(true);
    try {
      const res = await fetch(`/api/media?workspace=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setMediaAssets(data.assets);
      }
    } catch {
      toast.error("Failed to load media library");
    } finally {
      setLoadingMedia(false);
    }
  }, [activeWorkspace]);

  function pickFromLibrary(url: string) {
    setProductImageUrl(url);
    setProductPreview(url);
    setShowMediaPicker(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    setSubmitting(true);

    try {
      // Check if user has required API keys
      const keysRes = await fetch("/api/user/api-keys");
      if (keysRes.ok) {
        const keys: { provider: string }[] = await keysRes.json();
        const providers = keys.map((k) => k.provider);
        const missing: string[] = [];
        if (!providers.includes("gemini")) missing.push("Gemini");
        if (!providers.includes("fal")) missing.push("fal.ai");
        if (missing.length > 0) {
          toast.error(
            `Please add your ${missing.join(" and ")} API key${missing.length > 1 ? "s" : ""} in Settings before generating posts.`
          );
          setSubmitting(false);
          return;
        }
      }

      const briefsRes = await fetch("/api/generate/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          websiteUrl: websiteUrl.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          tonePrefs: tonePrefs.trim() || undefined,
          postsCount: parseInt(postsCount, 10),
          workspaceId: activeWorkspace?.id || undefined,
          brandColors: activeWorkspace?.brandColors || undefined,
          brandFonts: activeWorkspace?.brandFonts || undefined,
          brandGuidelines: activeWorkspace?.brandGuidelines || undefined,
          logoUrl: activeWorkspace?.logoUrl || undefined,
          productImageUrl: productImageUrl || undefined,
        }),
      });

      if (!briefsRes.ok) {
        try {
          const err = await briefsRes.json();
          toast.error(err.error || "Failed to start generation.");
        } catch {
          toast.error("Failed to start generation.");
        }
        return;
      }

      const briefsData = await briefsRes.json();
      const newBatchId: string = briefsData.batchId;
      const initialPosts: GeneratedPost[] = briefsData.posts.map(
        (p: { id: string; hookCategory?: string; captionHook?: string; whyThisWorks?: string }) => ({
          ...p,
          status: "generating" as const,
        })
      );

      setBatchId(newBatchId);
      setPosts(initialPosts);
      setDoneCount(0);
      setStep("generating");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── FORM ─────────────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Create Posts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Step 1 of 2: Configure your AI post generation settings.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          {/* Violet gradient banner */}
          <div className="h-16 bg-gradient-to-r from-violet-400 via-violet-300 to-violet-200" />

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Business name */}
            <div className="space-y-1.5">
              <Label htmlFor="businessName" className="text-sm font-medium text-slate-700">
                Business Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="businessName"
                placeholder="e.g. Acme Coffee Co."
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 h-10 rounded-xl"
              />
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="websiteUrl" className="text-sm font-medium text-slate-700">
                Website URL
              </Label>
              <div className="relative">
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 h-10 rounded-xl pr-10"
                />
                <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Target audience */}
              <div className="space-y-1.5">
                <Label htmlFor="targetAudience" className="text-sm font-medium text-slate-700">
                  Target Audience
                </Label>
                <Textarea
                  id="targetAudience"
                  placeholder="Describe your ideal customer..."
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  rows={3}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 rounded-xl resize-none text-sm"
                />
              </div>

              {/* Tone */}
              <div className="space-y-1.5">
                <Label htmlFor="tonePrefs" className="text-sm font-medium text-slate-700">
                  Tone &amp; Style
                </Label>
                <Textarea
                  id="tonePrefs"
                  placeholder="e.g. Professional, Witty, Casual..."
                  value={tonePrefs}
                  onChange={(e) => setTonePrefs(e.target.value)}
                  rows={3}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 rounded-xl resize-none text-sm"
                />
              </div>
            </div>

            {/* Posts count */}
            <div className="space-y-1.5">
              <Label htmlFor="postsCount" className="text-sm font-medium text-slate-700">Number of Posts</Label>
              <Select value={postsCount} onValueChange={setPostsCount}>
                <SelectTrigger
                  id="postsCount"
                  className="bg-white border-slate-300 text-slate-900 focus:ring-violet-500/20 h-10 rounded-xl w-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  {[1, 2, 3, 5, 10].map((n) => (
                    <SelectItem
                      key={n}
                      value={String(n)}
                      className="text-slate-900 hover:bg-slate-50 focus:bg-slate-50 cursor-pointer"
                    >
                      {n} Post{n !== 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Photo (optional) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Product Photo <span className="text-xs text-slate-400 font-normal">(optional)</span>
              </Label>
              {productPreview || productImageUrl ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
                    <Image
                      src={productPreview || productImageUrl || ""}
                      alt="Product photo"
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                    {uploadingProduct && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      Replace
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleProductUpload(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={removeProduct}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-3 h-14 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-colors cursor-pointer px-4">
                    <Upload className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-400">Upload new (PNG, JPG, WebP — max 5MB)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProductUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {activeWorkspace && (
                    <button
                      type="button"
                      onClick={openMediaPicker}
                      className="flex items-center gap-2 h-14 px-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4 text-slate-300" />
                      <span className="text-xs text-slate-400 whitespace-nowrap">Pick from library</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Logo indicator */}
            {activeWorkspace?.logoUrl && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <Check className="w-3.5 h-3.5" />
                Brand logo from workspace will be included in generated posts
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !businessName.trim() || uploadingProduct}
              className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-all duration-150 gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate {postsCount} Post{parseInt(postsCount) !== 1 ? "s" : ""}
                </>
              )}
            </Button>

          </form>
        </div>
      </div>

      {/* Media Library Picker Dialog */}
      <Dialog open={showMediaPicker} onOpenChange={setShowMediaPicker}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Pick from Media Library
            </DialogTitle>
          </DialogHeader>
          {loadingMedia ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          ) : mediaAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <Package className="w-8 h-8" />
              <p className="text-sm">No images in your media library yet.</p>
              <p className="text-xs">Go to Media Library to upload product photos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 overflow-y-auto py-2 pr-1">
              {mediaAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => pickFromLibrary(asset.url)}
                  className="relative aspect-square rounded-xl border-2 border-slate-200 hover:border-violet-500 bg-white overflow-hidden transition-colors cursor-pointer group"
                >
                  <Image
                    src={asset.url}
                    alt={asset.filename}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/10 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
    );
  }

  // ── GENERATING ───────────────────────────────────────────────────────────────
  if (step === "generating") {
    return (
      <div className="max-w-5xl space-y-8">
        {/* Progress header */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Generating posts…</h2>
              <p className="text-slate-500 text-sm">
                {doneCount} of {totalCount} complete — this takes 30–60 seconds per image
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Progress
              value={progress}
              className="h-2 bg-slate-200 [&>div]:bg-gradient-to-r [&>div]:from-violet-600 [&>div]:to-violet-400 [&>div]:transition-all [&>div]:duration-500"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>{doneCount} done</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post, i) => (
            <PostCard key={post.id || i} post={post} />
          ))}
        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {completedCount} post{completedCount !== 1 ? "s" : ""} ready!
            </h1>
            <p className="text-slate-500 text-sm">
              We&apos;ve generated these posts based on your &ldquo;{businessName}&rdquo; campaign settings.
              {failedCount > 0 ? ` ${failedCount} failed.` : " Review, edit, and schedule them directly."}
            </p>
          </div>
        </div>
      </div>

      {/* Progress complete bar */}
      <div className="rounded-xl bg-slate-100 p-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Generation Complete</span>
          <span>100%</span>
        </div>
        <Progress
          value={100}
          className="h-1.5 bg-slate-200 [&>div]:bg-violet-600"
        />
        <p className="text-xs text-slate-400 mt-1 text-right">
          Step 2 of 2
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post, i) => (
          <PostCard
            key={post.id || i}
            post={post}
            showPublish
            accounts={socialAccounts}
            onPublished={(id) =>
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === id ? { ...p, publishedAt: new Date().toISOString() } : p
                )
              )
            }
            onScheduled={(id, scheduledAt) =>
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === id ? { ...p, scheduledAt } : p
                )
              )
            }
            onEdited={(id, field, value) =>
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === id ? { ...p, [field]: value } : p
                )
              )
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          onClick={() => { setStep("form"); setPosts([]); setBatchId(null); setDoneCount(0); }}
        >
          <ArrowLeft className="w-4 h-4" />
          Regenerate All
        </button>
        <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2 rounded-xl cursor-pointer">
          <Sparkles className="w-4 h-4" />
          Schedule All Posts
        </Button>
      </div>
    </div>
  );
}
