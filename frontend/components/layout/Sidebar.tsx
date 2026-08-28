"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquareDot,
  FileText,
  UserCircle2,
  LogOut,
  Cpu,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeColor: string;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    activeColor: "text-sky-400",
  },
  {
    label: "AI Assistant",
    href: "/chat",
    icon: <MessageSquareDot className="w-4 h-4" />,
    activeColor: "text-cyan-400",
  },
  {
    label: "Documents & SOPs",
    href: "/documents",
    icon: <FileText className="w-4 h-4" />,
    activeColor: "text-emerald-400",
  },
  {
    label: "Profile & Access",
    href: "/profile",
    icon: <UserCircle2 className="w-4 h-4" />,
    activeColor: "text-purple-400",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <aside
      className="flex h-full w-56 flex-col"
      style={{
        background: "linear-gradient(180deg, #050d1a 0%, #020817 100%)",
        borderRight: "1px solid rgba(14,165,233,0.12)",
      }}
    >
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800/60">
        <div
          className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0"
          style={{ boxShadow: "0 0 12px rgba(14,165,233,0.3)", border: "1px solid rgba(14,165,233,0.3)" }}
        >
          <Image src="/aria-logo.jpg" alt="ARIA" fill className="object-cover" priority />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-sm font-bold tracking-widest text-white">ARIA</span>
          <span className="text-[9px] text-slate-500 uppercase tracking-wider truncate">
            RAG Intelligence
          </span>
        </div>
        {/* System online indicator */}
        <div className="ml-auto shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block aria-glow" />
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 px-2 py-4 flex-1">
        {/* Section label */}
        <p className="px-2 mb-2 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
          Navigation
        </p>

        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "aria-nav-active group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-sky-500/10 text-white"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <span
                className={cn(
                  "transition-colors",
                  isActive ? item.activeColor : "text-slate-500 group-hover:text-slate-300"
                )}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>

              {/* Active cyan left indicator */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sky-400"
                  style={{ boxShadow: "0 0 8px #0ea5e9" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── System status ──────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-slate-800/60">
        <div
          className="rounded-md px-3 py-2.5 mb-2 flex items-center gap-2"
          style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.1)" }}
        >
          <Cpu className="w-3 h-3 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-sky-400 uppercase tracking-wider">RAG Pipeline</p>
            <p className="text-[10px] text-slate-400 truncate">DeepSeek-V3 · BGE-M3</p>
          </div>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>

        <p className="text-[9px] text-slate-700 px-1 mt-2">ARIA V1 · Prototype Build</p>
      </div>
    </aside>
  );
}
