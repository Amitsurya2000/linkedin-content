"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PenSquare,
  History,
  CalendarDays,
  Settings,
} from "lucide-react";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Post", icon: PenSquare },
  { href: "/history", label: "History", icon: History },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
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
          ? "bg-[#ED383B]/15 text-[#ED383B]"
          : "text-[#94a3b8] hover:text-white hover:bg-white/5"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-[#ED383B]" : "group-hover:text-white")} />
      <span className="flex-1">{label}</span>
      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#ED383B] shrink-0" />}
    </Link>
  );
}

export function SidebarNav() {
  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {mainNav.map((item) => (
        <NavItem key={item.href} {...item} />
      ))}
    </nav>
  );
}
