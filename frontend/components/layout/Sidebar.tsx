"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import {
  LayoutDashboard,
  MessageSquareDot,
  FileText,
  UserCircle2,
  LogOut,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeColor: string;
  shortcut: string;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    activeColor: "text-sky-400",
    shortcut: "⌘1",
  },
  {
    label: "AI Assistant",
    href: "/chat",
    icon: <MessageSquareDot className="w-5 h-5 shrink-0" />,
    activeColor: "text-cyan-400",
    shortcut: "⌘2",
  },
  {
    label: "Knowledge Base",
    href: "/documents",
    icon: <FileText className="w-5 h-5 shrink-0" />,
    activeColor: "text-emerald-400",
    shortcut: "⌘3",
  },
  {
    label: "Profile & Access",
    href: "/profile",
    icon: <UserCircle2 className="w-5 h-5 shrink-0" />,
    activeColor: "text-purple-400",
    shortcut: "⌘4",
  },
];

interface SidebarProps {
  forceExpanded?: boolean;
}

export function Sidebar({ forceExpanded = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { isCollapsed: contextCollapsed, toggleCollapse } = useSidebar();
  const isCollapsed = forceExpanded ? false : contextCollapsed;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <aside
      className={cn(
        "h-full flex-col transition-all duration-300 border-r border-white/[0.06] bg-gradient-to-b from-[#050d1a] to-surface-1",
        isCollapsed ? "w-16" : "w-60",
        forceExpanded ? "flex w-full border-r-0" : "hidden md:flex relative"
      )}
    >
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <div className={cn("flex items-center py-5 border-b border-white/[0.06] h-[76px]", isCollapsed ? "justify-center px-0" : "px-4 gap-3")}>
        <div
          className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 shadow-[0_0_12px_rgba(14,165,233,0.3)] border border-sky-400/30"
        >
          <Image src="/aria-logo.jpg" alt="ARIA" fill sizes="36px" className="object-cover" priority />
        </div>
        {!isCollapsed && (
          <>
            <div className="flex flex-col leading-tight min-w-0 transition-opacity duration-300">
              <span className="text-sm font-bold tracking-widest text-white">ARIA</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider truncate">
                RAG Intelligence
              </span>
            </div>
            {/* System online indicator */}
            <div className="ml-auto shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
          </>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-1 px-2 py-4">
          {!isCollapsed && (
            <p className="px-2 mb-2 text-[9px] font-semibold uppercase tracking-widest text-slate-500 transition-opacity duration-300">
              Navigation
            </p>
          )}

          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-lg py-2.5 transition-all duration-200 overflow-hidden",
                  isCollapsed ? "justify-center px-0" : "px-3 gap-3",
                  isActive
                    ? "text-white bg-sky-500/10"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {/* Hover Glow Slide Effect */}
                {!isActive && (
                  <span className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-transparent -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
                )}
                
                <span
                  className={cn(
                    "relative z-10 transition-colors",
                    isActive ? item.activeColor : "text-slate-500 group-hover:text-slate-300"
                  )}
                >
                  {item.icon}
                </span>
                
                {!isCollapsed && (
                  <>
                    <span className="relative z-10 truncate text-sm font-medium flex-1">{item.label}</span>
                    <span className="relative z-10 text-[10px] font-medium text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                      {item.shortcut}
                    </span>
                  </>
                )}

                {/* Active cyan left indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-sky-400 shadow-[0_0_8px_#0ea5e9] transition-all"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Toggle Button (desktop only) */}
      {!forceExpanded && (
        <div className="px-3 pb-3">
          <button
            onClick={toggleCollapse}
            className={cn(
              "flex items-center justify-center w-full h-8 rounded-md text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 transition-colors",
            )}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* ── Bottom Section ─────────────────────────────────────────── */}
      <div className={cn("px-3 py-3 border-t border-white/[0.06] flex flex-col gap-3 transition-all", isCollapsed ? "items-center" : "")}>
        
        {/* User Avatar Area */}
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "px-2")}>
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shrink-0 text-sky-400 text-xs font-bold">
            JD
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white truncate">John Doe</span>
              <span className="text-[10px] text-sky-400 uppercase tracking-wider font-medium">Admin</span>
            </div>
          )}
        </div>

        {/* System status */}
        <div
          className={cn(
            "rounded-md flex items-center bg-sky-500/5 border border-sky-400/10",
            isCollapsed ? "justify-center w-8 h-8 p-0" : "px-3 py-2.5 gap-2"
          )}
          title={isCollapsed ? "RAG Pipeline Active" : undefined}
        >
          <Cpu className={cn("text-sky-400 shrink-0", isCollapsed ? "w-4 h-4" : "w-3 h-3")} />
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold text-sky-400 uppercase tracking-wider">RAG Pipeline</p>
                <p className="text-[10px] text-slate-400 truncate">DeepSeek-V3 · BGE-M3</p>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Sign Out" : undefined}
          className={cn(
            "flex items-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors",
            isCollapsed ? "justify-center w-8 h-8 p-0" : "w-full gap-2.5 px-3 py-2 text-xs"
          )}
        >
          <LogOut className={cn("shrink-0", isCollapsed ? "w-4 h-4" : "w-3.5 h-3.5")} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>

        {!isCollapsed && (
          <p className="text-[9px] text-slate-600 px-1 mt-1 text-center font-medium tracking-wide">ARIA V2 · Prototype Build</p>
        )}
      </div>
    </aside>
  );
}
