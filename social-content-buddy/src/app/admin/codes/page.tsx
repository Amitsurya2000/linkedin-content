"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Ticket,
  Loader2,
  Copy,
  Check,
  XCircle,
  Plus,
  Zap,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";

interface Redemption {
  codeId: string;
  userName: string | null;
  userEmail: string | null;
  redeemedAt: string;
}

interface InvitationCode {
  id: string;
  code: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdAt: string;
  redemptions: Redemption[];
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate section
  const [maxUses, setMaxUses] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  // Copy states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Expand/collapse redemptions
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  // Deactivate
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/codes");
      if (!res.ok) throw new Error("Failed to fetch codes");
      const data = await res.json();
      setCodes(data);
    } catch {
      toast.error("Failed to load invitation codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  async function generateCode() {
    if (maxUses < 1) {
      toast.error("Max uses must be at least 1");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setNewCode(data.code);
      toast.success(`Code generated: ${data.code}`);
      await fetchCodes();
    } catch {
      toast.error("Failed to generate code");
    } finally {
      setGenerating(false);
    }
  }

  async function deactivateCode(id: string) {
    setDeactivatingId(id);
    try {
      const res = await fetch(`/api/admin/codes?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Code deactivated");
      await fetchCodes();
    } catch {
      toast.error("Failed to deactivate code");
    } finally {
      setDeactivatingId(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  const activeCodes = codes.filter((c) => c.isActive && c.currentUses < c.maxUses);
  const exhaustedCodes = codes.filter((c) => c.currentUses >= c.maxUses);
  const totalRedemptions = codes.reduce((sum, c) => sum + c.currentUses, 0);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Invitation Codes</h1>
        <p className="text-slate-500 mt-1">
          Generate codes with usage limits and monitor redemptions.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Active Codes</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{activeCodes.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Total Redemptions</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{totalRedemptions}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Total Codes</p>
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-violet-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{codes.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Generate code section */}
      <Card className="bg-gradient-to-br from-violet-700 to-violet-900 border-0 text-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Generate New Code
          </CardTitle>
          <p className="text-violet-200 text-sm">Create a single invitation code and set how many times it can be used.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2 w-40">
              <Label htmlFor="maxUses" className="text-violet-200 text-sm">
                Max Uses
              </Label>
              <Input
                id="maxUses"
                type="number"
                min={1}
                max={10000}
                placeholder="e.g. 50"
                value={maxUses}
                onChange={(e) =>
                  setMaxUses(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="bg-white/10 border-white/20 text-white placeholder:text-violet-300 focus:border-white"
              />
            </div>
            <Button
              onClick={generateCode}
              disabled={generating}
              className="bg-white text-violet-700 hover:bg-violet-50 gap-2 font-semibold"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate Code
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Newly generated code */}
      {newCode && (
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <p className="text-slate-700 text-sm font-medium">
              New code generated — share it with users
            </p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex items-center gap-3">
              <span className="text-slate-900 font-mono text-lg tracking-wider font-bold">
                {newCode}
              </span>
              <button
                onClick={() => copyCode(newCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-violet-300 transition-colors cursor-pointer text-sm"
              >
                {copiedCode === newCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All codes table */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
            <Ticket className="w-4 h-4 text-violet-600" />
            All Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wider border-b border-slate-100 mb-1">
            <span>Code</span>
            <span>Status</span>
            <span>Usage</span>
            <span>Created</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {codes.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-10">
                No codes generated yet
              </p>
            )}
            {codes.map((code) => {
              const isDeactivating = deactivatingId === code.id;
              const isFull = code.currentUses >= code.maxUses;
              const status = !code.isActive
                ? "inactive"
                : isFull
                ? "exhausted"
                : "active";
              const isExpanded = expandedCode === code.id;
              const usagePercent = Math.round((code.currentUses / code.maxUses) * 100);

              return (
                <div key={code.id}>
                  <div
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3.5 hover:bg-slate-50 transition-colors rounded-lg cursor-pointer"
                    onClick={() => setExpandedCode(isExpanded ? null : code.id)}
                  >
                    {/* Code */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 font-mono text-sm tracking-wider">
                        {code.code}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCode(code.code);
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        {copiedCode === code.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Status */}
                    <div>
                      {status === "active" && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          Active
                        </Badge>
                      )}
                      {status === "exhausted" && (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
                          Fully Used
                        </Badge>
                      )}
                      {status === "inactive" && (
                        <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    {/* Usage */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[120px]">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFull ? "bg-slate-400" : "bg-violet-500"
                            }`}
                            style={{ width: `${Math.min(100, usagePercent)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-slate-600 tabular-nums whitespace-nowrap">
                        {code.currentUses}/{code.maxUses}
                      </span>
                    </div>

                    {/* Created at */}
                    <div className="text-slate-500 text-sm">
                      {new Date(code.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isDeactivating}
                          onClick={() => deactivateCode(code.id)}
                          className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5"
                        >
                          {isDeactivating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Deactivate
                        </Button>
                      )}
                      {code.redemptions.length > 0 && (
                        isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )
                      )}
                    </div>
                  </div>

                  {/* Expanded redemptions list */}
                  {isExpanded && code.redemptions.length > 0 && (
                    <div className="px-4 pb-3 ml-4 border-l-2 border-violet-100">
                      <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">
                        Redeemed by
                      </p>
                      <div className="space-y-2">
                        {code.redemptions.map((r, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                              {(r.userName || r.userEmail || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-slate-900">{r.userName || r.userEmail}</span>
                            <span className="text-slate-400 text-xs">
                              {new Date(r.redeemedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
