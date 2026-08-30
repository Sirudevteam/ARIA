"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Building, FolderGit2, Key, RefreshCw } from "lucide-react";

export default function ProfilePage() {
  const { user, profile, role, effectivePermissions, refreshProfile, isLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setIsRefreshing(false);
  };

  const getRoleBadgeStyle = (roleName?: string) => {
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            User Profile & Authorization
            {role && (
              <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-semibold ${getRoleBadgeStyle(role)}`}>
                {role}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-slate-400">
            Validated cryptographic identity, tenant organization, and active project access rights.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-sky-400" : ""}`} />
          Sync Credentials
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Identity */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" /> Account Identity
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Supabase Auth & PostgreSQL identity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Full Name</span>
              <span className="text-white font-medium">{profile?.name || user?.email?.split("@")[0] || "Authenticated User"}</span>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Email Address</span>
              <span className="text-slate-300 break-all">{profile?.email || user?.email}</span>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Account Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-400 font-medium text-xs capitalize">{profile?.status || "Active"}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider block">User UUID</span>
              <span className="text-[11px] font-mono text-slate-400 break-all">{profile?.id || user?.id}</span>
            </div>
          </CardContent>
        </Card>

        {/* Center / Right Columns: Org, RBAC, Projects */}
        <div className="space-y-6 md:col-span-2">
          {/* Organization & Role */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-sky-400" /> Tenant Organization & RBAC
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Organization</span>
                  <span className="text-white font-semibold text-sm">{profile?.organization?.name || "Autocruise Dynamics AI"}</span>
                  <span className="text-xs text-slate-500 block mt-0.5">Slug: {profile?.organization?.slug || "autocruise"}</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Assigned Role</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${getRoleBadgeStyle(role || "ANNOTATOR")}`}>
                      {role || "ANNOTATOR"}
                    </Badge>
                    <span className="text-xs text-slate-400">({profile?.role?.scope || "organization"})</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {profile?.role?.description || "Active enterprise access privileges."}
                  </p>
                </div>
              </div>

              {/* Effective Permissions */}
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-400" /> Effective Granted Permissions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {effectivePermissions.length > 0 ? (
                    effectivePermissions.map((perm, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-300"
                      >
                        {perm}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No specific permissions assigned</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accessible Projects */}
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-sky-400" /> Authorized Project Memberships ({profile?.projects?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Projects and LiDAR datasets where you have access authorization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profile?.projects && profile.projects.length > 0 ? (
                  profile.projects.map((proj) => (
                    <div
                      key={proj.project_id}
                      className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <span className="text-white font-medium text-sm block">{proj.project_name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">ID: {proj.project_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {proj.project_role && (
                          <Badge variant="outline" className={`text-xs ${getRoleBadgeStyle(proj.project_role)}`}>
                            {proj.project_role}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[11px] border-emerald-800/60 bg-emerald-950/40 text-emerald-400">
                          {proj.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 text-center">
                    No active projects assigned yet. Contact your Project Manager to join a dataset project.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
