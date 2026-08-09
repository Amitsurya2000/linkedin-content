import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Ticket,
  ImageIcon,
  Shield,
  LogOut,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const adminNavLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/codes", label: "Invitation Codes", icon: Ticket },
  { href: "/admin/posts", label: "Posts", icon: ImageIcon },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-slate-200">
        {/* Logo + Admin badge */}
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">PostAI</span>
          </div>
          <Badge className="bg-red-50 text-red-600 border-red-200 text-xs font-semibold flex items-center gap-1.5 w-fit">
            <Shield className="w-3 h-3" />
            Admin Panel
          </Badge>
        </div>

        <Separator className="bg-slate-200" />

        {/* Admin nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {adminNavLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 group"
            >
              <Icon className="w-4 h-4 shrink-0 group-hover:text-violet-600 transition-colors" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        <Separator className="bg-slate-200" />

        {/* Back to dashboard + sign out */}
        <div className="px-3 py-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 group"
          >
            <ArrowLeft className="w-4 h-4 shrink-0 group-hover:text-violet-600 transition-colors" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150 text-sm font-medium"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
