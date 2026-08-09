"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-context";
import {
  ChevronDown,
  Plus,
  Building2,
  Check,
  Loader2,
} from "lucide-react";

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    refreshWorkspaces,
    loading,
  } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          businessName: newName.trim(),
        }),
      });
      if (!res.ok) {
        toast.error("Failed to create workspace");
        return;
      }
      const ws = await res.json();
      await refreshWorkspaces();
      setActiveWorkspaceId(ws.id);
      toast.success(`"${ws.name}" created`);
      setCreating(false);
      setNewName("");
      setOpen(false);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="px-3 py-3 border-b border-slate-200">
        <div className="h-9 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b border-slate-200 relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all cursor-pointer"
      >
        <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <span className="text-sm font-medium text-slate-900 truncate flex-1 text-left">
          {activeWorkspace ? activeWorkspace.name : "Select workspace"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setCreating(false); }} />

          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 max-h-64 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setActiveWorkspaceId(ws.id);
                  setOpen(false);
                  router.refresh();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ws.name}</p>
                  {ws.businessName !== ws.name && (
                    <p className="text-xs text-slate-400 truncate">{ws.businessName}</p>
                  )}
                </div>
                {activeWorkspace?.id === ws.id && (
                  <Check className="w-4 h-4 text-violet-600 shrink-0" />
                )}
              </button>
            ))}

            {/* Divider */}
            {workspaces.length > 0 && <div className="my-1.5 mx-3 border-t border-slate-100" />}

            {/* Create new */}
            {creating ? (
              <div className="px-3 py-2 space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Business name..."
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreate}
                    disabled={submitting || !newName.trim()}
                    className="flex-1 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Create
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(""); }}
                    className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-sm font-medium text-slate-500">New workspace</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
