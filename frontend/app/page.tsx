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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
      {/* Background ambient radial gradients */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* LiDAR background dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, #2563eb 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm px-6">
        {/* Animated logo wrapper */}
        <div className="relative group">
          {/* Pulsing ring */}
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-md animate-pulse" />
          
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-blue-200 bg-white flex items-center justify-center">
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
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
          </span>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h1 className="text-xl font-extrabold tracking-widest text-slate-900">ARIA</h1>
          </div>
          <p className="text-xs text-slate-500 font-mono tracking-wider uppercase font-semibold">
            Annotation RAG Intelligence Assistant
          </p>
        </div>

        {/* Progress status */}
        <div className="flex flex-col items-center space-y-2.5 w-full pt-2">
          {/* Animated line */}
          <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-blue-600 w-1/2 rounded-full aria-scan-pulse" />
          </div>
          <p className="text-[11px] text-slate-500 font-mono tracking-wide h-4 font-medium">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
}
