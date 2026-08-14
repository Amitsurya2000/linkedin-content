"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Eye, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiKeyCardProps {
  provider: string;
  title: string;
  description: string;
  placeholder: string;
  icon: React.ReactNode;
}

interface KeyMeta {
  id: string;
  provider: string;
  keyPrefix: string;
  createdAt: string;
}

export function ApiKeyCard({
  provider,
  title,
  description,
  placeholder,
  icon,
}: ApiKeyCardProps) {
  const [keyMeta, setKeyMeta] = useState<KeyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    fetchKeyMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchKeyMeta() {
    try {
      const res = await fetch("/api/user/api-keys");
      if (!res.ok) return;
      const keys: KeyMeta[] = await res.json();
      const match = keys.find((k) => k.provider === provider);
      setKeyMeta(match ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!inputValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: inputValue.trim() }),
      });
      if (!res.ok) {
        toast.error("Failed to save API key");
        return;
      }
      toast.success(`${title} API key saved`);
      setInputValue("");
      setShowInput(false);
      await fetchKeyMeta();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        toast.error("Failed to revoke API key");
        return;
      }
      toast.success(`${title} API key revoked`);
      setKeyMeta(null);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRevoking(false);
    }
  }

  const isConnected = !!keyMeta;

  return (
    <div className="rounded-2xl bg-white border border-[#F5C5C7] overflow-hidden shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1A1A1A]">{title}</h2>
              <p className="text-xs text-[#6B6B6B]">{description}</p>
            </div>
          </div>
          {loading ? (
            <Loader2 className="w-4 h-4 text-[#6B6B6B] animate-spin" />
          ) : isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#FCEBEC] text-[#6B6B6B]">
              Not configured
            </span>
          )}
        </div>

        {isConnected && !showInput ? (
          <div className="space-y-1.5">
            <p className="text-xs text-[#6B6B6B] font-medium">API Key</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-[#F5C5C7] rounded-xl px-4 py-2.5 font-mono text-sm text-[#6B6B6B] tracking-wider">
                {keyMeta.keyPrefix}••••••••••••••••••••••••••
              </div>
              <button
                onClick={() => setShowInput(true)}
                className="w-10 h-10 rounded-xl border border-[#F5C5C7] bg-white flex items-center justify-center text-[#6B6B6B] hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer"
                title="Update key"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="w-10 h-10 rounded-xl border border-[#F5C5C7] bg-white flex items-center justify-center text-[#6B6B6B] hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-50"
                title="Revoke key"
              >
                {revoking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-[#6B6B6B]">
              Added {new Date(keyMeta.createdAt).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-[#6B6B6B] font-medium">
              {isConnected ? "Update API Key" : "Enter API Key"}
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 bg-white border-[#F5C5C7] text-[#1A1A1A] placeholder:text-[#6B6B6B] focus-visible:ring-red-500/20 focus-visible:border-red-500 h-10 rounded-xl font-mono text-sm"
              />
              <Button
                onClick={handleSave}
                disabled={saving || !inputValue.trim()}
                className="h-10 bg-red-600 hover:bg-red-700 text-[#1A1A1A] rounded-xl px-4 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </Button>
              {isConnected && (
                <button
                  onClick={() => { setShowInput(false); setInputValue(""); }}
                  className="text-xs text-[#6B6B6B] hover:text-[#6B6B6B] cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
