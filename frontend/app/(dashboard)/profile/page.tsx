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
        return "border-purple-300 bg-purple-50 text-purple-700 shadow-xs";
      case "ADMIN":
        return "border-blue-300 bg-blue-50 text-blue-700 shadow-xs";
      case "MANAGER":
        return "border-indigo-300 bg-indigo-50 text-indigo-700";
      case "ANNOTATOR":
        return "border-emerald-300 bg-emerald-50 text-emerald-700";
      case "QC":
        return "border-amber-300 bg-amber-50 text-amber-700";
      case "VALIDATOR":
        return "border-teal-300 bg-teal-50 text-teal-700";
      default:
        return "border-slate-300 bg-slate-100 text-slate-700";
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
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              Profile & Authorization
              {role && (
                <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-semibold ${getRoleBadgeStyle(role)}`}>
                  <Shield className="w-3 h-3 mr-1" />
                  {role}
                </Badge>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
              Cryptographic identity, tenant organization, and active project access rights.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold self-start sm:self-auto shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            Sync Credentials
          </Button>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Identity Card */}
        <SlideUp delay={100}>
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <Avatar className="w-20 h-20 border-2 border-blue-200 shadow-sm">
                    <AvatarFallback className="bg-blue-50 text-blue-700 text-xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
              </div>
              <CardTitle className="text-lg text-slate-900 font-bold">{displayName}</CardTitle>
              <CardDescription className="text-xs text-slate-500 truncate font-normal">
                {profile?.email || user?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm border-t border-slate-100 pt-4">
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1 font-semibold">
                  Account Status
                </span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold text-xs">
                    {profile?.status || "Active & Verified"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1 font-semibold">
                  User UUID
                </span>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-mono text-slate-600 truncate mr-2 font-medium">
                    {profile?.id || user?.id || "—"}
                  </span>
                  <button
                    onClick={() => handleCopy(profile?.id || user?.id || "", "uuid")}
                    className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                  >
                    {copiedField === "uuid" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1 font-semibold">
                  Authentication Engine
                </span>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between font-medium">
                  <span>Clerk JWT + RS256</span>
                  <Badge variant="outline" className="border-blue-200 text-[10px] text-blue-700 bg-blue-50 font-semibold">
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
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" /> Tenant Organization & RBAC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1 font-semibold">
                      Organization
                    </span>
                    <span className="text-slate-900 font-bold text-sm block">
                      {profile?.organization?.name || "Autonomous Perception AI"}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
                      slug: {profile?.organization?.slug || "autonomous-perception-ai"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1 font-semibold">
                      Assigned Role
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${getRoleBadgeStyle(role || "ANNOTATOR")}`}>
                        {role || "ANNOTATOR"}
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium">({profile?.role?.scope || "organization"})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 font-normal">
                      {profile?.role?.description || "3D LiDAR annotation, cuboid labeling, and point cloud segmentation"}
                    </p>
                  </div>
                </div>

                {/* Effective Permissions */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-600" /> Effective Granted Permissions
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
                        className="border-slate-200 bg-slate-50 text-slate-700 font-mono text-[10px] px-2 py-0.5 hover:border-blue-300 transition-colors font-medium"
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
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-emerald-600" /> Project Access & Scopes
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-normal">
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
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4 hover:border-blue-300 transition-all shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">{proj.name}</span>
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                            Active
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 font-normal">{proj.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-slate-600 block font-semibold">{proj.access}</span>
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
