"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, LogOut, Shield } from "lucide-react";

const titleMap: Record<string, string> = {
  "/chat": "LiDAR Knowledge Assistant",
  "/documents": "Annotation Schemas & SOPs",
  "/search": "Semantic Search",
  "/profile": "User Profile & Security",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, logout } = useAuth();
  const title = titleMap[pathname] ?? "Dashboard";

  const getRoleBadgeStyle = (roleName?: string | null) => {
    switch (roleName) {
      case "SUPER_ADMIN":
        return "border-purple-500/50 bg-purple-950/50 text-purple-300";
      case "ADMIN":
        return "border-blue-500/50 bg-blue-950/50 text-blue-300";
      case "MANAGER":
        return "border-indigo-500/50 bg-indigo-950/50 text-indigo-300";
      case "ANNOTATOR":
        return "border-emerald-500/50 bg-emerald-950/50 text-emerald-300";
      case "QC":
        return "border-amber-500/50 bg-amber-950/50 text-amber-300";
      case "VALIDATOR":
        return "border-teal-500/50 bg-teal-950/50 text-teal-300";
      default:
        return "border-slate-600 bg-slate-800 text-slate-300";
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-slate-900/90 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>API Connected</span>
        </div>

        {/* User Role Badge & Profile */}
        {user ? (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            {role && (
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold px-2 py-0.5 ${getRoleBadgeStyle(role)}`}
              >
                <Shield className="w-3 h-3 mr-1" />
                {role}
              </Badge>
            )}

            <Link
              href="/profile"
              className="flex items-center gap-2 px-2.5 py-1 rounded-md hover:bg-slate-800/80 transition text-xs text-slate-200"
            >
              <div className="w-6 h-6 rounded-full bg-sky-950 border border-sky-500/40 text-sky-400 flex items-center justify-center font-bold text-[10px]">
                {profile?.name?.[0] || user.email?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="font-medium hidden md:inline">{profile?.name || user.email?.split("@")[0]}</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 px-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <Link href="/login">
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white text-xs h-8">
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
