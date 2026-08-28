"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ChevronRight } from "lucide-react";

const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/chat": { label: "AI Assistant", parent: "Dashboard" },
  "/documents": { label: "Knowledge Base", parent: "Dashboard" },
  "/profile": { label: "Profile & Access", parent: "Dashboard" },
  "/admin": { label: "Admin", parent: "Dashboard" },
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

export function Header() {
  const pathname = usePathname();
  const { user, profile, role } = useAuth();
  const page = breadcrumbMap[pathname] ?? { label: "ARIA" };

  const initials =
    profile?.name
      ? profile.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
      : (user?.email?.[0]?.toUpperCase() ?? "U");

  const displayName = profile?.name || user?.email?.split("@")[0] || "User";

  return (
    <header
      className="flex h-12 items-center justify-between px-5"
      style={{
        borderBottom: "1px solid rgba(14,165,233,0.1)",
        background: "rgba(5,13,26,0.85)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {page.parent && (
          <>
            <span className="text-slate-600">{page.parent}</span>
            <ChevronRight className="w-3 h-3 text-slate-700" />
          </>
        )}
        <span className="text-slate-300 font-medium">{page.label}</span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* RAG online status */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-500 font-mono">RAG ACTIVE</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-800" />

        {/* Role badge */}
        {role && (
          <Badge
            variant="outline"
            className={`text-[9px] font-semibold px-1.5 py-0.5 ${roleStyles[role] ?? roleStyles["VIEWER"]}`}
          >
            <Shield className="w-2.5 h-2.5 mr-1" />
            {role}
          </Badge>
        )}

        {/* User avatar */}
        {user ? (
          <Link
            href="/profile"
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-800/60 transition-colors"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-sky-300 shrink-0"
              style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)" }}
            >
              {initials}
            </div>
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
