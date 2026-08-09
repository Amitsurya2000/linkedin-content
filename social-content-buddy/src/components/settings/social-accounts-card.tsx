"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Instagram, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SocialAccount {
  id: string;
  platform: string;
  accountId: string;
  username: string | null;
  displayName: string | null;
}

export function SocialAccountsCard({ hasGetLateKey }: { hasGetLateKey: boolean }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!hasGetLateKey) { setLoading(false); return; }

    // After OAuth callback, sync from GetLate to pull newly connected account
    if (searchParams.get("success") === "instagram_connected") {
      toast.success("Instagram account connected! Syncing...");
      window.history.replaceState({}, "", "/settings");
      fetchAccounts(true);
    } else {
      fetchAccounts(false);
    }
  }, [hasGetLateKey]);

  async function fetchAccounts(sync = false) {
    try {
      const url = sync ? "/api/user/social-accounts?sync=true" : "/api/user/social-accounts";
      const res = await fetch(url);
      if (res.ok) {
        setAccounts(await res.json());
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    await fetchAccounts(true);
    toast.success("Accounts synced");
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/user/social-accounts/connect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to start connection");
        return;
      }
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(accountId: string) {
    setDisconnecting(accountId);
    try {
      const res = await fetch("/api/user/social-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) {
        toast.error("Failed to disconnect account");
        return;
      }
      toast.success("Account disconnected");
      setAccounts((prev) => prev.filter((a) => a.accountId !== accountId));
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDisconnecting(null);
    }
  }

  if (!hasGetLateKey) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Social Accounts</h2>
              <p className="text-xs text-slate-500">
                Add your GetLate.dev API key above to connect Instagram accounts.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Social Accounts</h2>
              <p className="text-xs text-slate-500">
                Connect your Instagram accounts via GetLate.dev
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 text-xs border-slate-200 hover:border-violet-300 hover:text-violet-600 cursor-pointer"
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 text-xs border-slate-200 hover:border-violet-300 hover:text-violet-600 cursor-pointer"
            >
              {connecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Connect Instagram
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No accounts connected yet.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Instagram className="w-4 h-4 text-pink-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      @{account.username || "Unknown"}
                    </p>
                    {account.displayName && (
                      <p className="text-xs text-slate-500">{account.displayName}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(account.accountId)}
                  disabled={disconnecting === account.accountId}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  title="Disconnect"
                >
                  {disconnecting === account.accountId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
