"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight, Menu, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const breadcrumbMap: Record<string, { label: string; parent?: string; parentPath?: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/chat": { label: "AI Assistant", parent: "Dashboard", parentPath: "/dashboard" },
  "/documents": { label: "Knowledge Base", parent: "Dashboard", parentPath: "/dashboard" },
  "/profile": { label: "Profile & Access", parent: "Dashboard", parentPath: "/dashboard" },
  "/admin": { label: "Admin", parent: "Dashboard", parentPath: "/dashboard" },
};

const roleStyles: Record<string, string> = {
  SUPER_ADMIN: "border-purple-500/40 bg-purple-950/40 text-purple-300",
  ADMIN: "border-blue-500/40 bg-blue-950/40 text-blue-300",
  MANAGER: "border-indigo-500/40 bg-indigo-950/40 text-indigo-300",
  ANNOTATOR: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
  QC: "border-amber-500/40 bg-amber-950/40 text-amber-300",
  VALIDATOR: "border-teal-500/40 bg-teal-950/40 text-teal-300",
  VIEWER: "border-slate-600 bg-slate-800 text-slate-400",
};

interface HeaderProps {
  onCommandPaletteOpen?: () => void;
  onMobileMenuToggle?: () => void;
}

export function Header({ onCommandPaletteOpen, onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { user, profile, role } = useAuth();
  const page = breadcrumbMap[pathname] ?? { label: "ARIA" };

  const initials =
    profile?.name
      ? profile.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
      : (user?.email?.[0]?.toUpperCase() ?? "U");

  const displayName = profile?.name || user?.email?.split("@")[0] || "User";
  const hasUnread = false;

  return (
    <header className="flex h-14 items-center justify-between px-3 sm:px-5 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.06] shrink-0 z-20">
      {/* Left side */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5 text-xs truncate">
          {page.parent && page.parentPath ? (
            <>
              <Link href={page.parentPath} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                {page.parent}
              </Link>
              <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
            </>
          ) : page.parent ? (
            <>
              <span className="text-slate-500 shrink-0">{page.parent}</span>
              <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
            </>
          ) : null}
          <span className="text-white font-medium truncate">{page.label}</span>
        </div>
      </div>

      {/* Center - Command Palette Trigger */}
      <div className="hidden md:flex flex-1 items-center justify-center px-4 max-w-sm lg:max-w-md mx-auto">
        <button
          onClick={onCommandPaletteOpen}
          className="w-full flex items-center justify-between bg-slate-800/40 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 hover:border-white/[0.1] transition-all"
        >
          <span className="truncate">Search or jump to...</span>
          <kbd className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400 shrink-0 ml-2">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Mobile Search Icon button for < md */}
      <button
        onClick={onCommandPaletteOpen}
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors ml-auto mr-1"
        aria-label="Open Command Palette"
      >
        <kbd className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-white/[0.08]">⌘K</kbd>
      </button>

      {/* Right cluster */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* RAG online status */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          <span className="text-[10px] text-slate-400 font-mono tracking-wider">RAG ACTIVE</span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-slate-800" />
        
        {/* Notifications */}
        <button 
          className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-slate-950" />
          )}
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-800" />

        {/* Role badge */}
        {role && (
          <Badge
            variant="outline"
            className={`hidden md:inline-flex text-[9px] font-semibold px-1.5 py-0.5 ${roleStyles[role] ?? roleStyles["VIEWER"]}`}
          >
            <Shield className="w-2.5 h-2.5 mr-1" />
            {role}
          </Badge>
        )}

        {/* User avatar */}
        {user ? (
          <Link
            href="/profile"
            className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-slate-800/60 transition-colors"
          >
            <Avatar className="w-6 h-6 border border-sky-400/30">
              <AvatarFallback className="bg-sky-500/15 text-sky-400 text-[10px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-slate-300 hidden md:inline font-medium">{displayName}</span>
          </Link>
        ) : (
          <Link href="/login">
            <Button size="sm" className="h-7 text-xs bg-sky-500 hover:bg-sky-600 text-white">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
