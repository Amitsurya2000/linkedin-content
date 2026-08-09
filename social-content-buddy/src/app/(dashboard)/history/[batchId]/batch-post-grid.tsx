"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Download,
  Hash,
  ImageIcon,
  CheckCircle2,
  Clock,
  Pencil,
  Check,
  X,
  Send,
  Calendar,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Post {
  id: string;
  hookCategory: string | null;
  captionHook: string | null;
  whyThisWorks: string | null;
  imageUrl: string | null;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

interface SocialAccount {
  id: string;
  platform: string;
  accountId: string;
  username: string | null;
}

async function showApiError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    toast.error(data.error || fallback);
  } catch {
    toast.error(fallback);
  }
}

function AccountButton({
  account,
  loading,
  disabled,
  icon: Icon,
  onClick,
}: {
  account: SocialAccount;
  loading: boolean;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50 transition-colors cursor-pointer disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5 text-violet-600" />
      )}
      @{account.username || "Instagram"}
    </button>
  );
}

function EditablePostCard({
  post,
  accounts,
  onEdited,
  onPublished,
  onScheduled,
}: {
  post: Post;
  accounts: SocialAccount[];
  onEdited: (field: string, value: string) => void;
  onPublished: (postId: string) => void;
  onScheduled: (postId: string, scheduledAt: string) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [actionMode, setActionMode] = useState<"idle" | "publish">("idle");
  const [scheduleDate, setScheduleDate] = useState("");

  const isActionable = post.status === "completed" && !post.publishedAt && !post.scheduledAt;

  function getDefaultScheduleMin() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toISOString().slice(0, 16);
  }

  async function saveEdit(field: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue }),
      });
      if (!res.ok) {
        await showApiError(res, "Failed to save");
        return;
      }
      onEdited(field, editValue);
      toast.success("Updated");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
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
        await showApiError(res, "Failed to publish");
        return;
      }
      toast.success("Post published to Instagram!");
      onPublished(post.id);
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
        await showApiError(res, "Failed to schedule");
        return;
      }
      toast.success("Post scheduled!");
      onScheduled(post.id, scheduledAt.toISOString());
    } catch {
      toast.error("Something went wrong");
    } finally {
      setScheduling(false);
      setScheduleDate("");
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm group">
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
        {post.imageUrl && (
          <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <a
              href={post.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/90 hover:bg-white text-slate-900 text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
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
              <button onClick={() => saveEdit("hookCategory")} disabled={saving} className="text-violet-600 hover:text-violet-700 cursor-pointer">
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
              <button
                onClick={() => { setEditingField("hookCategory"); setEditValue(post.hookCategory || ""); }}
                className="opacity-0 group-hover/hook:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity"
              >
                <Pencil className="w-3 h-3" />
              </button>
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
                <button onClick={() => saveEdit("captionHook")} disabled={saving} className="text-xs text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50">
                  {saving ? "..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 group/caption">
              <p className="text-slate-900 text-sm font-medium leading-snug flex-1">
                {post.captionHook}
              </p>
              <button
                onClick={() => { setEditingField("captionHook"); setEditValue(post.captionHook || ""); }}
                className="opacity-0 group-hover/caption:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity mt-0.5 shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )
        )}

        {/* Why this works — editable */}
        {post.whyThisWorks && (
          editingField === "whyThisWorks" ? (
            <div className="space-y-1.5">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                className="w-full text-xs px-3 py-2 rounded-lg border border-violet-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button onClick={() => setEditingField(null)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer px-2 py-0.5">Cancel</button>
                <button onClick={() => saveEdit("whyThisWorks")} disabled={saving} className="text-xs text-white bg-violet-600 hover:bg-violet-700 px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50">
                  {saving ? "..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 group/why">
              <p className="text-slate-500 text-xs leading-relaxed flex-1">
                {post.whyThisWorks}
              </p>
              <button
                onClick={() => { setEditingField("whyThisWorks"); setEditValue(post.whyThisWorks || ""); }}
                className="opacity-0 group-hover/why:opacity-100 text-slate-400 hover:text-violet-600 cursor-pointer transition-opacity mt-0.5 shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )
        )}

        {/* Status badges */}
        {post.publishedAt && (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Published
          </div>
        )}
        {post.scheduledAt && !post.publishedAt && (
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            Scheduled for{" "}
            {new Date(post.scheduledAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        )}

        {/* Publish / Schedule actions */}
        {isActionable && (
          <div className="mt-2 space-y-2">
            {actionMode === "idle" && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (accounts.length === 0) {
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
                        if (accounts.length === 0) {
                          toast.error("Connect an Instagram account in Settings first");
                        }
                      }}
                      className="rounded-xl gap-1.5 text-sm cursor-pointer border-slate-300 text-slate-700 hover:border-violet-300 hover:bg-violet-50"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Schedule
                    </Button>
                  </PopoverTrigger>
                  {accounts.length > 0 && (
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
                            <AccountButton
                              key={acc.accountId}
                              account={acc}
                              loading={scheduling}
                              disabled={scheduling || !scheduleDate}
                              icon={Clock}
                              onClick={() => handleSchedule(acc.accountId)}
                            />
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
              </div>
            )}

            {/* Account selector for Publish Now */}
            {actionMode === "publish" && accounts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 font-medium">Publish to:</p>
                {accounts.map((acc) => (
                  <AccountButton
                    key={acc.accountId}
                    account={acc}
                    loading={publishing}
                    disabled={publishing}
                    icon={Send}
                    onClick={() => handlePublish(acc.accountId)}
                  />
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
      </div>
    </div>
  );
}

export function BatchPostGrid({ initialPosts, batchId }: { initialPosts: Post[]; batchId: string }) {
  const [posts, setPosts] = useState(initialPosts);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch social accounts for publish/schedule
  useEffect(() => {
    fetch("/api/user/social-accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAccounts)
      .catch(() => {});
  }, []);

  // Poll for updates while any post is still generating
  const hasGenerating = posts.some(
    (p) => p.status === "generating" || p.status === "pending"
  );

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (hasGenerating && batchId) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/generate/status/${batchId}`);
          if (!r.ok) return;
          const data = await r.json();
          if (data.posts) {
            setPosts((prev) => {
              let changed = false;
              const next = prev.map((p) => {
                const updated = data.posts.find((u: Post) => u.id === p.id);
                if (!updated) return p;
                if (
                  p.status === updated.status &&
                  (p.imageUrl ?? null) === (updated.imageUrl ?? null) &&
                  (p.hookCategory ?? null) === (updated.hookCategory ?? null) &&
                  (p.captionHook ?? null) === (updated.captionHook ?? null) &&
                  (p.whyThisWorks ?? null) === (updated.whyThisWorks ?? null)
                ) return p;
                changed = true;
                return {
                  ...p,
                  status: updated.status,
                  imageUrl: updated.imageUrl ?? p.imageUrl,
                  hookCategory: updated.hookCategory ?? p.hookCategory,
                  captionHook: updated.captionHook ?? p.captionHook,
                  whyThisWorks: updated.whyThisWorks ?? p.whyThisWorks,
                };
              });
              return changed ? next : prev;
            });
          }
        } catch {
          // silently ignore polling errors
        }
      }, 5000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasGenerating, batchId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <EditablePostCard
          key={post.id}
          post={post}
          accounts={accounts}
          onEdited={(field, value) =>
            setPosts((prev) =>
              prev.map((p) => (p.id === post.id ? { ...p, [field]: value } : p))
            )
          }
          onPublished={(postId) =>
            setPosts((prev) =>
              prev.map((p) =>
                p.id === postId
                  ? { ...p, publishedAt: new Date().toISOString() }
                  : p
              )
            )
          }
          onScheduled={(postId, scheduledAt) =>
            setPosts((prev) =>
              prev.map((p) =>
                p.id === postId ? { ...p, scheduledAt } : p
              )
            )
          }
        />
      ))}
    </div>
  );
}
