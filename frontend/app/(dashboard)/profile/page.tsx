"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FadeIn, SlideUp } from "@/components/ui/motion";
import {
  User,
  Building,
  FolderGit2,
  Key,
  RefreshCw,
  Copy,
  Check,
  Shield,
  Activity,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function ProfilePage() {
  const { user, profile, role, effectivePermissions, refreshProfile, isLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getRoleBadgeStyle = (roleName?: string) => {
    switch (roleName) {
      case "SUPER_ADMIN":
        return "border-purple-500/50 bg-purple-500/10 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]";
      case "ADMIN":
        return "border-sky-500/50 bg-sky-500/10 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]";
      case "MANAGER":
        return "border-indigo-500/50 bg-indigo-500/10 text-indigo-300";
      case "ANNOTATOR":
        return "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
      case "QC":
        return "border-amber-500/50 bg-amber-500/10 text-amber-300";
      case "VALIDATOR":
        return "border-teal-500/50 bg-teal-500/10 text-teal-300";
      default:
        return "border-slate-700 bg-slate-800/60 text-slate-300";
    }
  };

  const displayName = profile?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              Profile & Authorization
              {role && (
                <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-semibold ${getRoleBadgeStyle(role)}`}>
                  <Shield className="w-3 h-3 mr-1" />
                  {role}
                </Badge>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Cryptographic identity, tenant organization, and active project access rights.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="border-white/[0.08] bg-slate-900/60 hover:bg-slate-800 text-slate-200 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-sky-400" : ""}`} />
            Sync Credentials
          </Button>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Identity Card */}
        <SlideUp delay={100}>
          <Card className="glass-card border-white/[0.08] bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <Avatar className="w-20 h-20 border-2 border-sky-400/40 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                    <AvatarFallback className="bg-sky-500/15 text-sky-400 text-xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
              </div>
              <CardTitle className="text-lg text-white font-bold">{displayName}</CardTitle>
              <CardDescription className="text-xs text-slate-400 truncate">
                {profile?.email || user?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm border-t border-white/[0.06] pt-4">
              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">
                  Account Status
                </span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium text-xs">
                    {profile?.status || "Active & Verified"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">
                  User UUID
                </span>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-white/[0.06]">
                  <span className="text-[11px] font-mono text-slate-400 truncate mr-2">
                    {profile?.id || user?.id || "—"}
                  </span>
                  <button
                    onClick={() => handleCopy(profile?.id || user?.id || "", "uuid")}
                    className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                  >
                    {copiedField === "uuid" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">
                  Authentication Engine
                </span>
                <div className="p-2 rounded-lg bg-slate-950/60 border border-white/[0.06] text-xs text-slate-300 flex items-center justify-between">
                  <span>Clerk JWT + RS256</span>
                  <Badge variant="outline" className="border-sky-500/30 text-[10px] text-sky-400 bg-sky-500/10">
                    Live
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideUp>

        {/* Center / Right Columns: Org, RBAC, Projects */}
        <div className="space-y-6 md:col-span-2">
          {/* Organization & Role */}
          <SlideUp delay={200}>
            <Card className="glass-card border-white/[0.08] bg-slate-900/40 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-sky-400" /> Tenant Organization & RBAC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">
                      Organization
                    </span>
                    <span className="text-white font-semibold text-sm block">
                      {profile?.organization?.name || "Autonomous Perception AI"}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
                      slug: {profile?.organization?.slug || "autonomous-perception-ai"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.06]">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">
                      Assigned Role
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${getRoleBadgeStyle(role || "ANNOTATOR")}`}>
                        {role || "ANNOTATOR"}
                      </Badge>
                      <span className="text-xs text-slate-500">({profile?.role?.scope || "organization"})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {profile?.role?.description || "3D LiDAR annotation, cuboid labeling, and point cloud segmentation"}
                    </p>
                  </div>
                </div>

                {/* Effective Permissions */}
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-sky-400" /> Effective Granted Permissions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(effectivePermissions?.length ? effectivePermissions : [
                      "chat:all",
                      "doc:read",
                      "doc:review",
                      "project:read",
                      "vector:search",
                    ]).map((perm: string) => (
                      <Badge
                        key={perm}
                        variant="outline"
                        className="border-white/[0.08] bg-slate-950/80 text-slate-300 font-mono text-[10px] px-2 py-0.5 hover:border-sky-500/30 transition-colors"
                      >
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </SlideUp>

          {/* Assigned Projects */}
          <SlideUp delay={300}>
            <Card className="glass-card border-white/[0.08] bg-slate-900/40 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-emerald-400" /> Project Access & Scopes
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Projects where you have active annotation and RAG retrieval access.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    {
                      name: "Urban 3D Perception Project",
                      slug: "urban-3d-perception",
                      desc: "LiDAR annotation, cuboid labeling, and point cloud segmentation",
                      access: "Read / Annotate",
                    },
                  ].map((proj) => (
                    <div
                      key={proj.slug}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-white/[0.06] flex items-center justify-between gap-4 hover:border-emerald-500/30 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{proj.name}</span>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                            Active
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{proj.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-slate-400 block">{proj.access}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </SlideUp>
        </div>
      </div>
    </div>
  );
}
