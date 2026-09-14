import React from "react";
import { VehicleWireframe } from "@/components/ui/VehicleWireframe";
import { LidarBackground } from "@/components/ui/LidarBackground";
import Image from "next/image";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex bg-[#0a0f1a] overflow-hidden">
      <LidarBackground opacity={0.14} />

      {/* Top ambient radial glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_30%_0%,rgba(56,189,248,0.12)_0%,transparent_70%)]" />

      {/* Left brand showcase panel */}
      <div className="hidden lg:flex flex-col justify-between w-[460px] shrink-0 px-12 py-12 relative z-10 border-r border-white/[0.06] bg-slate-950/40 backdrop-blur-xl">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-12">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-[0_0_15px_rgba(56,189,248,0.25)] border border-sky-400/30">
              <Image src="/aria-logo.jpg" alt="ARIA" fill sizes="36px" className="object-cover" priority />
            </div>
            <div>
              <p className="text-white font-black text-base tracking-widest">ARIA</p>
              <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                RAG Intelligence Assistant
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-white leading-tight mb-4">
            Precision knowledge<br />
            for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400">
              3D LiDAR teams
            </span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
            Grounded answers directly from your engineering SOPs, sensor calibration specs,
            and annotation guidelines — verified with sentence-level source citations.
          </p>

          {/* Feature highlights */}
          <ul className="mt-8 space-y-3.5">
            {[
              "Zero-hallucination RAG with DeepSeek-V3",
              "Hybrid retrieval: Dense BGE-M3 + BM25 + Qdrant RRF",
              "Sub-50ms vector search with pgvector & Qdrant",
              "Enterprise RBAC with granular project access",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-xs text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Vehicle wireframe graphic */}
        <div className="opacity-60 -ml-4 pt-8">
          <VehicleWireframe width={340} height={230} />
        </div>
      </div>

      {/* Right form container */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
