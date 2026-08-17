"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Clock,
  CheckCircle2,
  Send,
  X,
  Hash,
  Pencil,
  Check,
  CalendarIcon,
  Ban,
} from "lucide-react";

interface CalendarPost {
  id: string;
  batchId: string;
  hookCategory: string | null;
  hook: string | null;
  body: string | null;
  hashtags: string[] | null;
  cta: string | null;
  whyThisWorks: string | null;
  imageUrl: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  approvalStatus: string | null;
  createdAt: string;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const days: { date: Date; inMonth: boolean }[] = [];

  // Previous month padding
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }

  // Current month
  for (let i = 1; i <= totalDays; i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }

  // Next month padding to fill 6 rows
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), inMonth: false });
  }

  return days;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PostMini({
  post,
  onClick,
}: {
  post: CalendarPost;
  onClick: () => void;
}) {
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", post.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-red-50 transition-colors text-left cursor-grab active:cursor-grabbing group"
    >
      {post.imageUrl ? (
        <div className="w-6 h-6 rounded shrink-0 relative overflow-hidden bg-[#FDF3F2]">
          <Image
            src={post.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="24px"
          />
        </div>
      ) : (
        <div className="w-6 h-6 rounded shrink-0 bg-[#FDF3F2] flex items-center justify-center">
          <ImageIcon className="w-3 h-3 text-[#6B5B5A]" />
        </div>
      )}
      <span className="text-xs text-[#6B5B5A] truncate flex-1 group-hover:text-[#8E1B18]">
        {post.hook || "Untitled"}
      </span>
      {post.publishedAt && <CheckCircle2 className="w-3 h-3 text-[#44712E] shrink-0" />}
      {post.scheduledAt && !post.publishedAt && <Clock className="w-3 h-3 text-[#B45309] shrink-0" />}
    </button>
  );
}

function PostDetail({
  post,
  onClose,
  onUpdated,
}: {
  post: CalendarPost;
  onClose: () => void;
  onUpdated: (updated: Partial<CalendarPost>) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt);
      return d.toISOString().slice(0, 10);
    }
    return "";
  });
  const [scheduleTime, setScheduleTime] = useState(() => {
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "";
  });
  const [statusSaving, setStatusSaving] = useState(false);

  function startEdit(field: "hook" | "body" | "hookCategory" | "whyThisWorks" | "hashtags") {
    setEditingField(field);
    if (field === "hashtags") {
      const tags = post.hashtags || [];
      setEditValue(tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join("\n"));
    } else {
      setEditValue((post[field] as string) || "");
    }
  }

  async function saveEdit(field: string) {
    setSaving(true);
    try {
      let body: Record<string, unknown>;
      if (field === "hashtags") {
        const tags = editValue
          .split(/[\n,]+/)
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean);
        body = { hashtags: tags };
      } else {
        body = { [field]: editValue };
      }
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
        return;
      }
      if (field === "hashtags") {
        const tags = editValue
          .split(/[\n,]+/)
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean);
        onUpdated({ hashtags: tags });
      } else {
        onUpdated({ [field]: editValue });
      }
      toast.success("Updated");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }

  async function patchSchedule() {
    if (!scheduleDate || !scheduleTime) {
      toast.error("Set both date and time to schedule");
      return;
    }
    setStatusSaving(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch("/api/posts/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to schedule");
        return;
      }
      onUpdated({ scheduledAt, approvalStatus: "scheduled", publishedAt: null });
      toast.success("Scheduled — added to your calendar");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handlePublishNow() {
    setStatusSaving(true);
    try {
      // Copy the full post so it's ready to paste into LinkedIn's composer.
      const tags = (post.hashtags || []).map((t) => `#${t.replace(/^#/, "")}`).join(" ");
      const full = `${post.hook || ""}\n\n${post.body || ""}${tags ? `\n\n${tags}` : ""}`.trim();
      try { await navigator.clipboard.writeText(full); } catch { /* clipboard may be blocked */ }

      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to publish");
        return;
      }
      onUpdated({ approvalStatus: "published", publishedAt: new Date().toISOString() });
      window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank");
      toast.success("Copied! Paste into LinkedIn (opened in a new tab).");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStatusSaving(false);
    }
  }

  async function patchApprovalStatus(newStatus: string, extras?: Record<string, unknown>) {
    setStatusSaving(true);
    try {
      const body: Record<string, unknown> = { approvalStatus: newStatus, ...extras };
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
        return;
      }
      onUpdated({ approvalStatus: newStatus, ...extras } as Partial<CalendarPost>);
      toast.success(`Status changed to ${newStatus}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        {post.imageUrl && (
          <div className="aspect-square relative bg-[#FDF3F2] rounded-t-2xl overflow-hidden">
            <Image src={post.imageUrl} alt="" fill className="object-cover" sizes="512px" />
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Close + Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {post.approvalStatus === "published" || post.publishedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#44712E] bg-[#D7EBCE] border border-[#B2D8A4] px-2 py-0.5 rounded-lg">
                  <CheckCircle2 className="w-3 h-3" /> Published
                </span>
              ) : post.approvalStatus === "scheduled" || (post.scheduledAt && !post.publishedAt) ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] bg-[#FCE2BA] border border-[#EFCB93] px-2 py-0.5 rounded-lg">
                  <Clock className="w-3 h-3" /> Scheduled{" "}
                  {post.scheduledAt &&
                    new Date(post.scheduledAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                </span>
              ) : post.approvalStatus === "approved" ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A66C2] bg-[#DCE6F1] border border-[#B7CDE7] px-2 py-0.5 rounded-lg">
                  <CheckCircle2 className="w-3 h-3" /> Approved
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#38434F] bg-[#E9E5DF] border border-[#D2CDC5] px-2 py-0.5 rounded-lg">
                  Draft
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-[#6B5B5A] hover:text-[#6B5B5A] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Approval Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {(!post.approvalStatus || post.approvalStatus === "draft") && (
              <button
                onClick={() => patchApprovalStatus("approved")}
                disabled={statusSaving}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-[#0A66C2] text-white hover:bg-[#004182] cursor-pointer disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {statusSaving ? "Saving..." : "Approve"}
              </button>
            )}
            {post.approvalStatus === "approved" && (
              <>
                <button
                  onClick={() => patchSchedule()}
                  disabled={statusSaving || !scheduleDate || !scheduleTime}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-[#B45309] text-white hover:bg-[#915907] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {statusSaving ? "Saving..." : "Schedule"}
                </button>
                <button
                  onClick={handlePublishNow}
                  disabled={statusSaving}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-[#44712E] text-white hover:bg-[#375C25] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {statusSaving ? "Saving..." : "Publish Now"}
                </button>
              </>
            )}
            {post.approvalStatus === "scheduled" && (
              <button
                onClick={() => patchApprovalStatus("approved", { scheduledAt: null })}
                disabled={statusSaving}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-[#B24020] text-white hover:bg-[#8E3319] cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                {statusSaving ? "Saving..." : "Cancel Schedule"}
              </button>
            )}
          </div>

          {/* Schedule Date/Time Picker */}
          {(post.approvalStatus === "approved" || post.approvalStatus === "scheduled") && (
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#6B5B5A] shrink-0" />
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#F2DAD8] bg-white text-[#6B5B5A] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
              />
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#F2DAD8] bg-white text-[#6B5B5A] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
              />
            </div>
          )}

          {/* Hook Category */}
          <div>
            <label className="text-xs text-[#6B5B5A] font-medium uppercase tracking-wider">Hook Category</label>
            {editingField === "hookCategory" ? (
              <div className="flex gap-2 mt-1">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-red-300 bg-white text-[#1A1414] focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  autoFocus
                />
                <button
                  onClick={() => saveEdit("hookCategory")}
                  disabled={saving}
                  className="text-[#C21D1D] hover:text-[#8E1B18] cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingField(null)}
                  className="text-[#6B5B5A] hover:text-[#6B5B5A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1 group">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-[#8E1B18] border border-red-200">
                  <Hash className="w-3 h-3" />
                  {post.hookCategory || "None"}
                </span>
                <button
                  onClick={() => startEdit("hookCategory")}
                  className="opacity-0 group-hover:opacity-100 text-[#6B5B5A] hover:text-[#C21D1D] cursor-pointer transition-opacity"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Hook */}
          <div>
            <label className="text-xs text-[#6B5B5A] font-medium uppercase tracking-wider">Hook</label>
            {editingField === "hook" ? (
              <div className="mt-1 space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-red-300 bg-white text-[#1A1414] focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-[#6B5B5A] hover:text-[#6B5B5A] cursor-pointer px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit("hook")}
                    disabled={saving}
                    className="text-xs text-white bg-[#ED383B] hover:bg-[#C21D1D] px-3 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1 group">
                <p className="text-[#1A1414] text-sm font-medium leading-snug flex-1">
                  {post.hook || "No hook"}
                </p>
                <button
                  onClick={() => startEdit("hook")}
                  className="opacity-0 group-hover:opacity-100 text-[#6B5B5A] hover:text-[#C21D1D] cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="text-xs text-[#6B5B5A] font-medium uppercase tracking-wider">Post Body</label>
            {editingField === "body" ? (
              <div className="mt-1 space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={5}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-red-300 bg-white text-[#1A1414] focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-[#6B5B5A] hover:text-[#6B5B5A] cursor-pointer px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit("body")}
                    disabled={saving}
                    className="text-xs text-white bg-[#ED383B] hover:bg-[#C21D1D] px-3 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1 group">
                <p className="text-[#6B5B5A] text-sm leading-relaxed flex-1 whitespace-pre-wrap">
                  {post.body || "No body text"}
                </p>
                <button
                  onClick={() => startEdit("body")}
                  className="opacity-0 group-hover:opacity-100 text-[#6B5B5A] hover:text-[#C21D1D] cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Hashtags */}
          <div>
            <label className="text-xs text-[#6B5B5A] font-medium uppercase tracking-wider">Hashtags</label>
            {editingField === "hashtags" ? (
              <div className="mt-1 space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                  placeholder={"#hashtag1\n#hashtag2\n#hashtag3"}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-red-300 bg-white text-[#1A1414] focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none font-mono"
                  autoFocus
                />
                <p className="text-[10px] text-[#6B5B5A]">One hashtag per line, or comma-separated. The # prefix is optional.</p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-[#6B5B5A] hover:text-[#6B5B5A] cursor-pointer px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit("hashtags")}
                    disabled={saving}
                    className="text-xs text-white bg-[#ED383B] hover:bg-[#C21D1D] px-3 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1 group">
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {post.hashtags && post.hashtags.length > 0 ? (
                    post.hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-lg bg-red-50 text-[#C21D1D] border border-red-100"
                      >
                        #{tag.replace(/^#/, "")}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#6B5B5A]">No hashtags</span>
                  )}
                </div>
                <button
                  onClick={() => startEdit("hashtags")}
                  className="opacity-0 group-hover:opacity-100 text-[#6B5B5A] hover:text-[#C21D1D] cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Why this works */}
          <div>
            <label className="text-xs text-[#6B5B5A] font-medium uppercase tracking-wider">Why This Works</label>
            {editingField === "whyThisWorks" ? (
              <div className="mt-1 space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-red-300 bg-white text-[#1A1414] focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-[#6B5B5A] hover:text-[#6B5B5A] cursor-pointer px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit("whyThisWorks")}
                    disabled={saving}
                    className="text-xs text-white bg-[#ED383B] hover:bg-[#C21D1D] px-3 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1 group">
                <p className="text-[#6B5B5A] text-xs leading-relaxed flex-1">
                  {post.whyThisWorks || "No description"}
                </p>
                <button
                  onClick={() => startEdit("whyThisWorks")}
                  className="opacity-0 group-hover:opacity-100 text-[#6B5B5A] hover:text-[#C21D1D] cursor-pointer transition-opacity mt-0.5 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Created date */}
          <p className="text-xs text-[#6B5B5A]">
            Created{" "}
            {new Date(post.createdAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const today = new Date();
  const { activeWorkspace } = useWorkspace();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);

  const days = getMonthDays(year, month);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const wsParam = activeWorkspace ? `&workspace=${activeWorkspace.id}` : "";
    try {
      const res = await fetch(`/api/posts/calendar?start=${start}&end=${end}${wsParam}`);
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch {
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, [year, month, activeWorkspace]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  // Group posts by date key
  const postsByDate: Record<string, CalendarPost[]> = {};
  for (const post of posts) {
    // Use scheduledAt if set, else publishedAt, else createdAt
    const d = post.scheduledAt || post.publishedAt || post.createdAt;
    const key = dateKey(new Date(d));
    if (!postsByDate[key]) postsByDate[key] = [];
    postsByDate[key].push(post);
  }

  const todayKey = dateKey(today);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  async function handleDrop(targetDate: Date, postId: string) {
    // Set scheduledAt to noon on the target date (preserves the day clearly)
    const scheduled = new Date(targetDate);
    scheduled.setHours(12, 0, 0, 0);

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduled.toISOString() }),
      });
      if (!res.ok) {
        toast.error("Failed to reschedule");
        return;
      }
      // Update local state
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, scheduledAt: scheduled.toISOString() } : p
        )
      );
      toast.success(`Moved to ${targetDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1414] tracking-tight">Calendar</h1>
          <p className="text-[#6B5B5A] text-sm mt-1">
            View and manage your scheduled, published, and draft posts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            className="rounded-xl text-sm border-[#F2DAD8] text-[#6B5B5A] hover:bg-red-50 hover:border-red-300 cursor-pointer"
          >
            Today
          </Button>
          <div className="flex items-center gap-1 bg-white border border-[#F2DAD8] rounded-xl px-1">
            <button onClick={prevMonth} className="p-1.5 hover:bg-[#FDF3F2] rounded-lg cursor-pointer">
              <ChevronLeft className="w-4 h-4 text-[#6B5B5A]" />
            </button>
            <span className="text-sm font-semibold text-[#1A1414] px-3 min-w-[140px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-[#FDF3F2] rounded-lg cursor-pointer">
              <ChevronRight className="w-4 h-4 text-[#6B5B5A]" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[#6B5B5A]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FAE8E6]" /> Draft
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Published
        </span>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl bg-white border border-[#F2DAD8] shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#F2DAD8] bg-slate-50">
          {DAY_NAMES.map((day) => (
            <div key={day} className="py-2.5 text-center text-xs font-medium text-[#6B5B5A] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map(({ date, inMonth }, i) => {
            const key = dateKey(date);
            const isToday = key === todayKey;
            const dayPosts = postsByDate[key] || [];

            return (
              <div
                key={i}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverKey(key); }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverKey(null); const postId = e.dataTransfer.getData("text/plain"); if (postId) handleDrop(date, postId); }}
                className={`min-h-[120px] border-b border-r border-[#F2DAD8] p-1.5 transition-colors ${
                  inMonth ? "bg-white" : "bg-slate-50/50"
                } ${isToday ? "ring-2 ring-inset ring-red-400/40" : ""} ${dragOverKey === key ? "bg-red-50 ring-2 ring-inset ring-red-300" : ""}`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-red-600 text-[#1A1414]"
                        : inMonth
                        ? "text-[#6B5B5A]"
                        : "text-[#1A1414]"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-[#6B5B5A] font-medium">
                      {dayPosts.length}
                    </span>
                  )}
                </div>

                {/* Posts */}
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((post) => (
                    <PostMini
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <p className="text-[10px] text-[#6B5B5A] pl-1.5">
                      +{dayPosts.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 text-sm text-[#6B5B5A]">
        <span>
          <strong className="text-[#1A1414]">{posts.length}</strong> posts this month
        </span>
        <span>
          <strong className="text-[#C21D1D]">
            {posts.filter((p) => p.publishedAt).length}
          </strong>{" "}
          published
        </span>
        <span>
          <strong className="text-amber-600">
            {posts.filter((p) => p.scheduledAt && !p.publishedAt).length}
          </strong>{" "}
          scheduled
        </span>
        <span>
          <strong className="text-[#6B5B5A]">
            {posts.filter((p) => !p.scheduledAt && !p.publishedAt).length}
          </strong>{" "}
          drafts
        </span>
      </div>

      {/* Detail modal */}
      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdated={(updated) => {
            const merged = { ...selectedPost, ...updated };
            setSelectedPost(merged);
            setPosts((prev) =>
              prev.map((p) => (p.id === merged.id ? merged : p))
            );
          }}
        />
      )}
    </div>
  );
}
