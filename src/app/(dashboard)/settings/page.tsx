import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, ImageIcon, Key } from "lucide-react";
import { ApiKeyCard } from "@/components/settings/api-key-card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;
  const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!dbUser) redirect("/login");

  const initials = (dbUser.name || dbUser.email || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] tracking-tight italic">Settings</h1>
        <p className="text-[#6B6B6B] text-sm mt-1">Manage your profile and API keys.</p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl bg-white border border-[#F5C5C7] overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-red-600 to-red-800 text-[#1A1A1A] text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[#1A1A1A] font-semibold text-lg leading-none">
                  {dbUser.name || "No name set"}
                </p>
              </div>
              <p className="text-[#6B6B6B] text-sm mt-1">{dbUser.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys Section Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-[#6B6B6B]" />
          <h2 className="text-sm font-semibold text-[#6B6B6B] uppercase tracking-wider">API Keys</h2>
        </div>
        <p className="text-xs text-[#6B6B6B]">Add your own API keys to enable AI generation. Keys are encrypted at rest.</p>
      </div>

      {/* Gemini API Key */}
      <ApiKeyCard
        provider="gemini"
        title="Google Gemini"
        description="Required for generating LinkedIn posts"
        placeholder="AIzaSy..."
        icon={<Sparkles className="w-5 h-5 text-red-600" />}
      />

      {/* fal.ai API Key */}
      <ApiKeyCard
        provider="fal"
        title="fal.ai"
        description="Optional — enables AI image generation"
        placeholder="fal_..."
        icon={<ImageIcon className="w-5 h-5 text-red-600" />}
      />

      {/* Footer */}
      <div className="flex items-center justify-center gap-6 text-xs text-[#6B6B6B] pb-4">
        <span className="hover:text-[#6B6B6B] cursor-pointer">Privacy Policy</span>
        <span className="hover:text-[#6B6B6B] cursor-pointer">Terms of Service</span>
        <span className="hover:text-[#6B6B6B] cursor-pointer">Help Center</span>
      </div>
    </div>
  );
}
