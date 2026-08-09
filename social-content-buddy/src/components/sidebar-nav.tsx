"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusSquare,
  Layers,
  CalendarDays,
  Building2,
  Settings,
  Shield,
  FolderOpen,
} from "lucide-react";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Generate Posts", icon: PlusSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/history", label: "Posts", icon: Layers },
  { href: "/media-library", label: "Media Library", icon: FolderOpen },
  { href: "/workspace", label: "Workspace", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
];

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
        isActive
          ? "bg-violet-50 text-violet-700"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-violet-600" : "group-hover:text-slate-700")} />
      <span className="flex-1">{label}</span>
      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-600 shrink-0" />}
    </Link>
  );
}

export function SidebarNav({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <>
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {isAdmin && (
        <>
          <div className="mx-4 border-t border-slate-200" />
          <nav className="px-3 py-3 space-y-0.5">
            {adminNav.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </nav>
        </>
      )}
    </>
  );
}
