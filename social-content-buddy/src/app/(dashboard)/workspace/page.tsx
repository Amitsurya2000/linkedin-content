"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspace, type Workspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import {
  Building2,
  Globe,
  Users,
  MessageSquare,
  Palette,
  Type,
  FileText,
  Save,
  Loader2,
  Trash2,
  Plus,
  X,
  Instagram,
  Check,
  Unlink,
  Clock,
  Mail,
  Shield,
  UserMinus,
  Crown,
  Pencil,
  Upload,
  ImageIcon,
} from "lucide-react";

function ColorPicker({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {colors.map((color, i) => (
          <div key={i} className="flex items-center gap-1 group">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                const updated = [...colors];
                updated[i] = e.target.value;
                onChange(updated);
              }}
              className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
            />
            <span className="text-xs text-slate-500 font-mono">{color}</span>
            <button
              onClick={() => onChange(colors.filter((_, j) => j !== i))}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {colors.length < 6 && (
        <button
          onClick={() => onChange([...colors, "#7C3AED"])}
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add color
        </button>
      )}
    </div>
  );
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const { activeWorkspace, refreshWorkspaces, workspaces } = useWorkspace();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [tonePrefs, setTonePrefs] = useState("");
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [headingFont, setHeadingFont] = useState("");
  const [bodyFont, setBodyFont] = useState("");
  const [brandGuidelines, setBrandGuidelines] = useState("");
  const [timezone, setTimezone] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Instagram accounts
  interface SocialAccount {
    id: string;
    accountId: string;
    workspaceId: string | null;
    username: string | null;
    displayName: string | null;
  }
  const [allAccounts, setAllAccounts] = useState<SocialAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  // Team members
  interface TeamMember {
    id: string;
    userId: string;
    role: string;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
    userImage: string | null;
  }
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Populate form when workspace changes
  useEffect(() => {
    if (!activeWorkspace) return;
    setName(activeWorkspace.name);
    setBusinessName(activeWorkspace.businessName);
    setWebsiteUrl(activeWorkspace.websiteUrl || "");
    setTargetAudience(activeWorkspace.targetAudience || "");
    setTonePrefs(activeWorkspace.tonePrefs || "");
    setBrandColors((activeWorkspace.brandColors as string[]) || []);
    setHeadingFont(activeWorkspace.brandFonts?.heading || "");
    setBodyFont(activeWorkspace.brandFonts?.body || "");
    setBrandGuidelines(activeWorkspace.brandGuidelines || "");
    setTimezone(
      activeWorkspace.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    setLogoUrl(activeWorkspace.logoUrl || null);
  }, [activeWorkspace]);

  // Fetch all connected Instagram accounts
  useEffect(() => {
    setAccountsLoading(true);
    fetch("/api/user/social-accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllAccounts)
      .catch(() => setAllAccounts([]))
      .finally(() => setAccountsLoading(false));
  }, []);

  // Fetch team members
  useEffect(() => {
    if (!activeWorkspace) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    setMembersLoading(true);
    fetch(`/api/workspaces/${activeWorkspace.id}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [activeWorkspace]);

  const linkedAccount = activeWorkspace
    ? allAccounts.find((a) => a.workspaceId === activeWorkspace.id)
    : null;

  // Current user is the workspace owner (workspaces API only returns owned workspaces)
  const isOwner = true;

  async function handleLinkAccount(accountId: string) {
    if (!activeWorkspace) return;
    setLinking(true);
    try {
      const res = await fetch("/api/user/social-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, workspaceId: activeWorkspace.id }),
      });
      if (!res.ok) {
        toast.error("Failed to link account");
        return;
      }
      // Refresh accounts
      const updated = await fetch("/api/user/social-accounts").then((r) => r.json());
      setAllAccounts(updated);
      toast.success("Instagram account linked");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkAccount(accountId: string) {
    setLinking(true);
    try {
      const res = await fetch("/api/user/social-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, workspaceId: null }),
      });
      if (!res.ok) {
        toast.error("Failed to unlink account");
        return;
      }
      const updated = await fetch("/api/user/social-accounts").then((r) => r.json());
      setAllAccounts(updated);
      toast.success("Account unlinked");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLinking(false);
    }
  }

  async function handleInvite() {
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send invite");
        return;
      }
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!activeWorkspace) return;
    if (!confirm("Remove this member from the workspace?")) return;
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Member removed");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleLogoUpload(file: File) {
    if (!activeWorkspace) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "logo");
      formData.append("workspaceId", activeWorkspace.id);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        toast.error(data.error || "Failed to upload logo");
        return;
      }

      const { url } = await res.json();
      setLogoUrl(url);
      await refreshWorkspaces();
      toast.success("Logo uploaded");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!activeWorkspace) return;
    try {
      await fetch(`/api/workspaces/${activeWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      });
      setLogoUrl(null);
      await refreshWorkspaces();
      toast.success("Logo removed");
    } catch {
      toast.error("Failed to remove logo");
    }
  }

  async function handleSave() {
    if (!activeWorkspace) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          businessName: businessName.trim(),
          websiteUrl: websiteUrl.trim() || "",
          targetAudience: targetAudience.trim() || undefined,
          tonePrefs: tonePrefs.trim() || undefined,
          brandColors: brandColors.length > 0 ? brandColors : undefined,
          brandFonts:
            headingFont || bodyFont
              ? { heading: headingFont, body: bodyFont }
              : undefined,
          brandGuidelines: brandGuidelines.trim() || undefined,
          timezone: timezone || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }
      await refreshWorkspaces();
      toast.success("Workspace saved");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeWorkspace) return;
    if (!confirm(`Delete "${activeWorkspace.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Workspace deleted");
      await refreshWorkspaces();
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  if (!activeWorkspace) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Workspace</h1>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">No workspace selected</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">
              Create a workspace using the switcher in the sidebar to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Workspace Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Configure your business profile and brand kit for &ldquo;{activeWorkspace.name}&rdquo;.
        </p>
      </div>

      {/* Business Profile */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Business Profile</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Pre-fills your create form and provides context to AI.</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Workspace Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Coffee Brand"
                className="bg-white border-slate-300 text-slate-900 h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Business Name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Coffee Co."
                className="bg-white border-slate-300 text-slate-900 h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Website URL</Label>
            <div className="relative">
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                type="url"
                placeholder="https://example.com"
                className="bg-white border-slate-300 text-slate-900 h-10 rounded-xl pr-10"
              />
              <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Target Audience</Label>
              <Textarea
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Describe your ideal customer..."
                rows={3}
                className="bg-white border-slate-300 text-slate-900 rounded-xl resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Tone & Style</Label>
              <Textarea
                value={tonePrefs}
                onChange={(e) => setTonePrefs(e.target.value)}
                placeholder="e.g. Professional, Witty, Casual..."
                rows={3}
                className="bg-white border-slate-300 text-slate-900 rounded-xl resize-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Timezone</Label>
            <div className="relative">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm pl-3 pr-10 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <optgroup label="US">
                  <option value="America/New_York">Eastern Time (US)</option>
                  <option value="America/Chicago">Central Time (US)</option>
                  <option value="America/Denver">Mountain Time (US)</option>
                  <option value="America/Los_Angeles">Pacific Time (US)</option>
                  <option value="Pacific/Honolulu">Hawaii Time (US)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                  <option value="Europe/Moscow">Moscow (MSK)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Dubai">Dubai (GST)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                </optgroup>
                <optgroup label="Pacific">
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                  <option value="Pacific/Auckland">Auckland (NZST)</option>
                </optgroup>
              </select>
              <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Brand Kit */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Brand Kit</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">AI uses these to generate on-brand visuals.</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Logo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Logo</Label>
            <p className="text-xs text-slate-400">Upload your brand logo. AI will subtly integrate it into generated posts.</p>
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
                  <Image
                    src={logoUrl}
                    alt="Brand logo"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
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
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    onClick={handleRemoveLogo}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
                {uploadingLogo && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-colors cursor-pointer">
                {uploadingLogo ? (
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-slate-300 mb-1" />
                    <span className="text-xs text-slate-400">Click to upload logo (PNG, JPG, WebP — max 5MB)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {/* Colors */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Brand Colors</Label>
            <ColorPicker colors={brandColors} onChange={setBrandColors} />
          </div>

          {/* Fonts */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Heading Font</Label>
              <div className="relative">
                <Input
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value)}
                  placeholder="e.g. Plus Jakarta Sans"
                  className="bg-white border-slate-300 text-slate-900 h-10 rounded-xl pr-10"
                />
                <Type className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Body Font</Label>
              <div className="relative">
                <Input
                  value={bodyFont}
                  onChange={(e) => setBodyFont(e.target.value)}
                  placeholder="e.g. Inter"
                  className="bg-white border-slate-300 text-slate-900 h-10 rounded-xl pr-10"
                />
                <Type className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Brand Guidelines</Label>
            <div className="relative">
              <Textarea
                value={brandGuidelines}
                onChange={(e) => setBrandGuidelines(e.target.value)}
                placeholder="Any additional style instructions for the AI (e.g. 'Always use minimalist layouts', 'Never use red', 'Include our tagline: Fresh Daily')..."
                rows={4}
                className="bg-white border-slate-300 text-slate-900 rounded-xl resize-none text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Instagram Account */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Instagram className="w-4 h-4 text-pink-600" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Instagram Account</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Link an Instagram account for publishing from this workspace.</p>
        </div>

        <div className="p-6">
          {accountsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : allAccounts.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-slate-500">No Instagram accounts connected.</p>
              <p className="text-xs text-slate-400">
                Go to <a href="/settings" className="text-violet-600 hover:text-violet-700 underline">Settings</a> to connect your Instagram via GetLate.dev first.
              </p>
            </div>
          ) : linkedAccount ? (
            <div className="flex items-center justify-between bg-pink-50 border border-pink-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">@{linkedAccount.username || "Unknown"}</p>
                  {linkedAccount.displayName && (
                    <p className="text-xs text-slate-500">{linkedAccount.displayName}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  <Check className="w-3 h-3" /> Linked
                </span>
              </div>
              <button
                onClick={() => handleUnlinkAccount(linkedAccount.accountId)}
                disabled={linking}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                Unlink
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Choose an Instagram account for this workspace:</p>
              <div className="space-y-2">
                {allAccounts.map((account) => {
                  const usedBy = workspaces.find(
                    (w) => w.id !== activeWorkspace?.id && allAccounts.some(
                      (a) => a.accountId === account.accountId && a.workspaceId === w.id
                    )
                  );
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Instagram className="w-4 h-4 text-pink-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">@{account.username || "Unknown"}</p>
                          {account.displayName && (
                            <p className="text-xs text-slate-500">{account.displayName}</p>
                          )}
                        </div>
                        {usedBy && (
                          <span className="text-xs text-slate-400">
                            Used by &ldquo;{usedBy.name}&rdquo;
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => handleLinkAccount(account.accountId)}
                        disabled={linking}
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs border-violet-200 text-violet-600 hover:bg-violet-50 cursor-pointer disabled:opacity-50"
                      >
                        {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : "Link"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Members */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Team Members</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Invite team members to collaborate on this workspace.</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Members list */}
          {membersLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No team members yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                      {(member.userName || member.userEmail || "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {member.userName || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">{member.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg ${
                        member.role === "owner"
                          ? "text-amber-600 bg-amber-50 border border-amber-200"
                          : member.role === "editor"
                          ? "text-violet-600 bg-violet-50 border border-violet-200"
                          : "text-slate-500 bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {member.role === "owner" && <Crown className="w-3 h-3" />}
                      {member.role === "editor" && <Pencil className="w-3 h-3" />}
                      {member.role === "viewer" && <Shield className="w-3 h-3" />}
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                    {isOwner && member.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={removingId === member.userId}
                        className="text-slate-400 hover:text-red-500 cursor-pointer disabled:opacity-50 transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invite form (owner only) — hidden until email/Postmark is configured. Remove `false &&` to re-enable. */}
          {false && isOwner && (
            <div className="border-t border-slate-100 pt-5">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Invite a team member</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="bg-white border-slate-300 text-slate-900 h-10 rounded-xl pr-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInvite();
                    }}
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                  className="h-10 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm px-3 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl cursor-pointer disabled:opacity-50 h-10 px-4"
                >
                  {inviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Invite
                    </span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Invited users will see this workspace once they accept. Invites expire after 7 days.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? "Deleting..." : "Delete workspace"}
        </button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || !businessName.trim()}
          className="bg-violet-600 hover:bg-violet-700 text-white gap-2 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
