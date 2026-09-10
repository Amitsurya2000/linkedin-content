"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Linkedin, Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";

export type ShellUser = {
  name?: string | null;
  email?: string | null;
  initials: string;
};

/**
 * Responsive dashboard shell.
 *
 * Desktop (md+): fixed left sidebar beside a scrolling main column.
 * Mobile (below md): a slim top bar with a hamburger that opens the same
 * sidebar as a slide-in drawer, so the app is usable on phones and tablets.
 */
export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/20">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
          <Linkedin className="w-4 h-4 text-[#0A66C2]" />
        </div>
        <div>
          <span className="text-base font-bold text-white tracking-tight">LI Post Gen</span>
          <p className="text-[11px] font-medium text-white -mt-0.5 tracking-wide">LinkedIn Content AI</p>
        </div>
      </div>

      {/* Nav */}
      <SidebarNav />

      {/* Bottom section */}
      <div className="mt-auto border-t border-white/20 p-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/30 to-white/15 border border-white/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-none mb-0.5">
              {user.name || "User"}
            </p>
            <p className="text-xs text-white truncate">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white bg-white/15 border border-white/25 hover:bg-white hover:text-[#C21D1D] hover:border-white transition-all duration-150 text-sm font-semibold cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden below md */}
      <aside
        className="hidden md:flex w-64 shrink-0 flex-col text-white"
        style={{ background: "linear-gradient(160deg, #D4302E 0%, #A81818 100%)" }}
      >
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-3 text-white"
        style={{ background: "linear-gradient(160deg, #D4302E 0%, #A81818 100%)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
          </div>
          <span className="text-sm font-bold tracking-tight">LI Post Gen</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          {/* Drawer */}
          <aside
            className="relative z-10 w-72 max-w-[85vw] h-full flex flex-col text-white shadow-2xl"
            style={{ background: "linear-gradient(160deg, #D4302E 0%, #A81818 100%)" }}
          >
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto md:mt-0 mt-14">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-[clamp(20px,4vh,44px)]">{children}</div>
      </main>
    </div>
  );
}