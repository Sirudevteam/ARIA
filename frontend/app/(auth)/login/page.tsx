"use client";

import React, { Suspense, useState, useEffect } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { VehicleWireframe } from "@/components/ui/VehicleWireframe";
import { LidarBackground } from "@/components/ui/LidarBackground";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkHash = () => {
        setIsSignUp(window.location.hash.includes("sign-up"));
      };
      checkHash();
      window.addEventListener("hashchange", checkHash);
      return () => window.removeEventListener("hashchange", checkHash);
    }
  }, []);

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

      {/* Right form panel: Clerk SignIn / SignUp */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
              <span>Loading Clerk Auth...</span>
            </div>
          }
        >
          <div className="w-full max-w-md space-y-3">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-[#080f1e]/90 p-1 rounded-xl border border-sky-500/20 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  !isSignUp
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSignUp
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Create Account (Sign Up)
              </button>
            </div>

            {/* Clerk Form Component */}
            {isSignUp ? (
              <SignUp
                routing="hash"
                fallbackRedirectUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-[#080f1e]/95 border border-sky-500/20 shadow-2xl shadow-sky-500/10 text-white rounded-xl backdrop-blur-xl",
                    headerTitle: "text-white font-bold tracking-tight text-lg",
                    headerSubtitle: "text-slate-400 text-xs",
                    socialButtonsBlockButton: "bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white",
                    formButtonPrimary: "bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25",
                    formFieldLabel: "text-slate-300 text-xs font-medium",
                    formFieldInput: "bg-slate-900/80 border-slate-700 text-white focus:border-sky-500 focus:ring-sky-500",
                    footerActionLink: "text-sky-400 hover:text-sky-300",
                    identityPreviewText: "text-slate-200",
                    identityPreviewEditButton: "text-sky-400 hover:text-sky-300",
                  },
                }}
              />
            ) : (
              <SignIn
                routing="hash"
                fallbackRedirectUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-[#080f1e]/95 border border-sky-500/20 shadow-2xl shadow-sky-500/10 text-white rounded-xl backdrop-blur-xl",
                    headerTitle: "text-white font-bold tracking-tight text-lg",
                    headerSubtitle: "text-slate-400 text-xs",
                    socialButtonsBlockButton: "bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white",
                    formButtonPrimary: "bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25",
                    formFieldLabel: "text-slate-300 text-xs font-medium",
                    formFieldInput: "bg-slate-900/80 border-slate-700 text-white focus:border-sky-500 focus:ring-sky-500",
                    footerActionLink: "text-sky-400 hover:text-sky-300",
                    identityPreviewText: "text-slate-200",
                    identityPreviewEditButton: "text-sky-400 hover:text-sky-300",
                  },
                }}
              />
            )}
          </div>
        </Suspense>
      </div>
    </div>
  );
}
