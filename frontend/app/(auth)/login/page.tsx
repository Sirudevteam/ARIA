"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { VehicleWireframe } from "@/components/ui/VehicleWireframe";
import { LidarBackground } from "@/components/ui/LidarBackground";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Lock, Mail, User, AlertCircle, ArrowRight } from "lucide-react";

/* ── Demo role config ───────────────────────────────────────────────── */
const DEMO_USERS = [
  { email: "deenathedev@protonmail.com", role: "SUPER_ADMIN", name: "Deena", color: "border-purple-500/40 text-purple-400 bg-purple-950/30" },
  { email: "sarah.chen@autocruise.example.com", role: "ADMIN", name: "Sarah", color: "border-blue-500/40 text-blue-400 bg-blue-950/30" },
  { email: "alex.rivera@autocruise.example.com", role: "ANNOTATOR", name: "Alex", color: "border-emerald-500/40 text-emerald-400 bg-emerald-950/30" },
  { email: "marcus.vance@autocruise.example.com", role: "QC", name: "Marcus", color: "border-amber-500/40 text-amber-400 bg-amber-950/30" },
  { email: "elena.rostova@autocruise.example.com", role: "VALIDATOR", name: "Dr. Elena", color: "border-teal-500/40 text-teal-400 bg-teal-950/30" },
  { email: "maya.patel@autocruise.example.com", role: "VIEWER", name: "Maya", color: "border-slate-600 text-slate-400 bg-slate-900" },
];

function LoginForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, signup, switchDemoRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const handleClerkLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { error } = await login("");
      if (error) setErrorMessage(error);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to open Clerk Sign In");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClerkSignUp = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { error } = await signup("", "");
      if (error) setErrorMessage(error);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to open Clerk Sign Up");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoRole: string) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      // @ts-expect-error demoRole is RoleName
      await switchDemoRole(demoRole, demoEmail);
      router.push(redirectPath);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : `Failed demo login as ${demoRole}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-full max-w-sm rounded-xl p-6 space-y-5"
      style={{
        background: "rgba(8,15,30,0.95)",
        border: "1px solid rgba(14,165,233,0.18)",
        boxShadow: "0 0 40px rgba(14,165,233,0.08), 0 25px 50px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-bold text-white tracking-tight">
          Access ARIA Workspace
        </h2>
        <p className="text-xs text-slate-500">
          Sign in via Clerk or select a verified enterprise demo role
        </p>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-300">{errorMessage}</span>
        </div>
      )}

      {/* Clerk Action Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleClerkLogin}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold text-white transition-all bg-sky-500 hover:bg-sky-400"
          style={{
            boxShadow: "0 0 20px rgba(14,165,233,0.25)",
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to Clerk...</span>
            </>
          ) : (
            <>
              <span>Sign In with Clerk</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleClerkSignUp}
          disabled={isSubmitting}
          className="w-full py-2 rounded-md text-xs font-medium text-slate-300 hover:text-white transition-colors border border-slate-700/60 hover:bg-slate-800/40"
        >
          Create New Clerk Account
        </button>
      </div>

      {/* Demo quick-logins */}
      <div className="pt-1 border-t border-slate-800/60 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-sky-500" />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
            Demo Role Quick-Login
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleDemoLogin(u.email, u.role)}
              className={`px-2 py-1.5 rounded text-left transition-all ${u.color} hover:opacity-90 border text-[10px]`}
            >
              <span className="font-semibold block truncate">{u.name}</span>
              <span className="opacity-60 block truncate" style={{ fontSize: "8px" }}>{u.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex bg-[#020817] overflow-hidden">
      <LidarBackground opacity={0.14} />

      {/* Top conic glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 30% 0%, rgba(14,165,233,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 px-10 py-12 relative z-10">
        <div>
          {/* Wordmark */}
          <div className="flex items-center gap-2 mb-12">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-black text-sky-400"
              style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)" }}
            >
              A
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-widest">ARIA</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Annotation RAG Intelligence</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Precision knowledge<br />
            for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
              3D LiDAR teams
            </span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
            Real-time grounded answers from your engineering SOPs, calibration manuals,
            and annotation guidelines — verified by source citations.
          </p>

          {/* Feature list */}
          <ul className="mt-8 space-y-3">
            {[
              "Zero-hallucination RAG with DeepSeek-V3",
              "Hybrid retrieval with cross-encoder reranking",
              "Source citation with page-level traceability",
              "7-tier enterprise RBAC authorization",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Vehicle wireframe */}
        <div className="opacity-50 -ml-4">
          <VehicleWireframe width={300} height={215} />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
              <span>Loading...</span>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
