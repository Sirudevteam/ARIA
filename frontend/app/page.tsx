"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import Image from "next/image";
import { Sparkles } from "lucide-react";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [statusText, setStatusText] = useState("Initializing neural gateway...");

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setStatusText("Verifying knowledge credentials...");
    }, 600);

    const timer2 = setTimeout(() => {
      setStatusText("Connecting to 3D LiDAR perception engine...");
    }, 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const redirectTimer = setTimeout(() => {
        if (user) {
          router.replace("/dashboard");
        } else {
          router.replace("/sign-in");
        }
      }, 700);

      return () => clearTimeout(redirectTimer);
    }
  }, [user, isLoading, router]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0f1a] overflow-hidden">
      {/* Background ambient radial gradients */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-sky-500/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />

      {/* LiDAR background dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, #38bdf8 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm px-6">
        {/* Animated logo wrapper */}
        <div className="relative group">
          {/* Pulsing ring */}
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-sky-500/30 to-cyan-400/30 blur-md animate-pulse" />
          
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(56,189,248,0.25)] border border-sky-400/40 bg-slate-900 flex items-center justify-center">
            <Image
              src="/aria-logo.jpg"
              alt="ARIA"
              width={64}
              height={64}
              className="object-cover"
              priority
            />
          </div>

          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950" />
          </span>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h1 className="text-xl font-black tracking-widest text-white">ARIA</h1>
          </div>
          <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">
            Annotation RAG Intelligence Assistant
          </p>
        </div>

        {/* Progress status */}
        <div className="flex flex-col items-center space-y-2.5 w-full pt-2">
          {/* Animated line */}
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-cyan-300 w-1/2 rounded-full aria-scan-pulse" />
          </div>
          <p className="text-[11px] text-slate-500 font-mono tracking-wide h-4">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
}
