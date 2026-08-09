import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, invitationCodes, userApiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, ImageIcon, Share2, MessageSquare, Key } from "lucide-react";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { SocialAccountsCard } from "@/components/settings/social-accounts-card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!dbUser) redirect("/login");

  let inviteCode: string | null = null;
  if (dbUser.invitedByCode) {
    const [code] = await db
      .select()
      .from(invitationCodes)
      .where(eq(invitationCodes.id, dbUser.invitedByCode))
      .limit(1);
    inviteCode = code?.code ?? null;
  }

  // Check if user has GetLate key (for social accounts card)
  const [getlateKeyRow] = await db
    .select({ id: userApiKeys.id })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "getlate")))
    .limit(1);
  const hasGetLateKey = !!getlateKeyRow;

  const initials = (dbUser.name || dbUser.email || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight italic">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your profile, API keys, and integrations.</p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-violet-800 text-white text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-slate-900 font-semibold text-lg leading-none">
                  {dbUser.name || "No name set"}
                </p>
                {dbUser.isAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 font-medium uppercase">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm mt-1">{dbUser.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys Section Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">API Keys</h2>
        </div>
        <p className="text-xs text-slate-400">Add your own API keys to enable AI generation and publishing. Keys are encrypted at rest.</p>
      </div>

      {/* Gemini API Key */}
      <ApiKeyCard
        provider="gemini"
        title="Google Gemini"
        description="Required for generating captions and design briefs"
        placeholder="AIzaSy..."
        icon={<Sparkles className="w-5 h-5 text-violet-600" />}
      />

      {/* fal.ai API Key */}
      <ApiKeyCard
        provider="fal"
        title="fal.ai"
        description="Required for AI image generation"
        placeholder="fal_..."
        icon={<ImageIcon className="w-5 h-5 text-violet-600" />}
      />

      {/* GetLate API Key */}
      <ApiKeyCard
        provider="getlate"
        title="GetLate.dev"
        description="Optional — enables auto-posting to Instagram"
        placeholder="gl_..."
        icon={<Share2 className="w-5 h-5 text-violet-600" />}
      />

      {/* Social Accounts */}
      <SocialAccountsCard hasGetLateKey={hasGetLateKey} />

      {/* Account / Invitation Code */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Invitation Code Used</p>
          </div>
          {inviteCode ? (
            <span className="text-slate-900 font-mono text-sm tracking-widest bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 inline-block">
              {inviteCode}
            </span>
          ) : (
            <p className="text-slate-400 text-sm">No invitation code on record</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-400 pb-4">
        <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span>
        <span className="hover:text-slate-600 cursor-pointer">Terms of Service</span>
        <span className="hover:text-slate-600 cursor-pointer">Help Center</span>
      </div>
    </div>
  );
}
