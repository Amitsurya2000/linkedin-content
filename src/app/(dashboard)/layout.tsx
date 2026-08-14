import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { LogOut, Linkedin } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen bg-[#FCEBEC] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col bg-[#FFFFFF] border-r border-[#F5C5C7]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[#F5C5C7]">
          <div className="w-8 h-8 rounded-xl bg-[#ED383B] flex items-center justify-center shrink-0">
            <Linkedin className="w-4 h-4 text-[#1A1A1A]" />
          </div>
          <div>
            <span className="text-base font-bold text-[#1A1A1A] tracking-tight">LI Post Gen</span>
            <p className="text-[10px] text-[#64748b] -mt-0.5">LinkedIn Content AI</p>
          </div>
        </div>

        {/* Nav */}
        <SidebarNav />

        {/* Bottom section */}
        <div className="mt-auto border-t border-[#F5C5C7] p-4 space-y-3">
          {/* User row */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ED383B] to-[#7F1D1F] flex items-center justify-center text-[#1A1A1A] text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A1A] truncate leading-none mb-0.5">
                {user.name || "User"}
              </p>
              <p className="text-xs text-[#64748b] truncate">{user.email}</p>
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
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#1A1A1A] bg-[#FCEBEC] border border-[#F5C5C7] hover:bg-[#ED383B] hover:text-white hover:border-[#ED383B] transition-all duration-150 text-sm font-semibold cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#FCEBEC]">
        <div className="p-8 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
