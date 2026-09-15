"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    activeColor: "text-blue-600",
    shortcut: "⌘1",
  },
  {
    label: "AI Assistant",
    href: "/chat",
    icon: <MessageSquareDot className="w-5 h-5 shrink-0" />,
    activeColor: "text-blue-600",
    shortcut: "⌘2",
  },
  {
    label: "Knowledge Base",
    href: "/documents",
    icon: <FileText className="w-5 h-5 shrink-0" />,
    activeColor: "text-emerald-600",
    shortcut: "⌘3",
  },
  {
    label: "Profile & Access",
    href: "/profile",
    icon: <UserCircle2 className="w-5 h-5 shrink-0" />,
    activeColor: "text-purple-600",
    shortcut: "⌘4",
  },
];

interface SidebarProps {
  forceExpanded?: boolean;
}

export function Sidebar({ forceExpanded = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed: contextCollapsed, toggleCollapse } = useSidebar();
  const isCollapsed = forceExpanded ? false : contextCollapsed;

  return (
    <aside
      className={cn(
        "h-full flex-col transition-all duration-300 border-r border-slate-200 bg-white shadow-xs",
        isCollapsed ? "w-16" : "w-60",
        forceExpanded ? "flex w-full border-r-0" : "hidden md:flex relative"
      )}
    >
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <div className={cn("flex items-center py-5 border-b border-slate-100 h-[76px]", isCollapsed ? "justify-center px-0" : "px-4 gap-3")}>
        <div
          className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 shadow-sm border border-blue-200"
        >
          <Image src="/aria-logo.jpg" alt="ARIA" fill sizes="36px" className="object-cover" priority />
        </div>
        {!isCollapsed && (
          <>
            <div className="flex flex-col leading-tight min-w-0 transition-opacity duration-300">
              <span className="text-sm font-bold tracking-widest text-slate-900">ARIA</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider truncate font-medium">
                RAG Intelligence
              </span>
            </div>
            {/* System online indicator */}
            <div className="ml-auto shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 block shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </div>
          </>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-1 px-2 py-4">
          {!isCollapsed && (
            <p className="px-2 mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 transition-opacity duration-300">
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
                  "group relative flex items-center rounded-lg py-2.5 transition-all duration-150 overflow-hidden",
                  isCollapsed ? "justify-center px-0" : "px-3 gap-3",
                  isActive
                    ? "text-blue-700 bg-blue-50 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <span
                  className={cn(
                    "relative z-10 transition-colors",
                    isActive ? item.activeColor : "text-slate-400 group-hover:text-slate-600"
                  )}
                >
                  {item.icon}
                </span>
                
                {!isCollapsed && (
                  <>
                    <span className="relative z-10 truncate text-sm flex-1">{item.label}</span>
                    <span className={cn(
                      "relative z-10 text-[10px] font-medium px-1.5 py-0.5 rounded border",
                      isActive ? "text-blue-600 bg-white border-blue-200" : "text-slate-400 bg-slate-50 border-slate-200"
                    )}>
                      {item.shortcut}
                    </span>
                  </>
                )}

                {/* Active blue left indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-600 transition-all"
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
              "flex items-center justify-center w-full h-8 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors",
            )}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* ── Bottom Section ─────────────────────────────────────────── */}
      <div className={cn("px-3 py-3 border-t border-slate-100 flex flex-col gap-2.5 transition-all", isCollapsed ? "items-center" : "")}>
        
        {/* User Avatar Area */}
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "px-2 py-1")}>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 shrink-0 text-blue-700 text-xs font-bold">
            JD
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate">John Doe</span>
              <span className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold">Admin</span>
            </div>
          )}
        </div>

        {/* System status */}
        <div
          className={cn(
            "rounded-lg flex items-center bg-slate-50 border border-slate-200/80 shadow-2xs",
            isCollapsed ? "justify-center w-8 h-8 p-0" : "px-3 py-2.5 gap-2"
          )}
          title={isCollapsed ? "RAG Pipeline Active" : undefined}
        >
          <Cpu className={cn("text-blue-600 shrink-0", isCollapsed ? "w-4 h-4" : "w-3.5 h-3.5")} />
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-blue-700 uppercase tracking-wider">RAG Pipeline</p>
                <p className="text-[10px] text-slate-500 truncate font-medium">DeepSeek-V3 · BGE-M3</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </>
          )}
        </div>



        {!isCollapsed && (
          <p className="text-[9px] text-slate-400 px-1 mt-0.5 text-center font-medium tracking-wide">ARIA V2 · Enterprise Light</p>
        )}
      </div>
    </aside>
  );
}
