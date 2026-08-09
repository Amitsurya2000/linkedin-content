import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { LogOut, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/sidebar-nav";
import { WorkspaceProvider } from "@/components/workspace-context";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user;
  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <WorkspaceProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-slate-200">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">PostAI</span>
              <p className="text-[10px] text-slate-400 -mt-0.5">Business Pro</p>
            </div>
          </div>

          {/* Workspace Switcher */}
          <WorkspaceSwitcher />

          {/* Nav */}
          <SidebarNav isAdmin={user.isAdmin ?? false} />

          {/* Bottom section */}
          <div className="mt-auto border-t border-slate-200 p-4 space-y-3">
            {/* User row */}
            <div className="flex items-center gap-3 px-1">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-violet-800 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate leading-none mb-0.5">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>

            {/* Sign out */}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150 text-sm font-medium cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-8 max-w-6xl">{children}</div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}
