import React from "react";
import { VehicleWireframe } from "@/components/ui/VehicleWireframe";
import { LidarBackground } from "@/components/ui/LidarBackground";

export function AuthShell({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}
