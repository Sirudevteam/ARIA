"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { VehicleWireframe } from "@/components/ui/VehicleWireframe";
import { LidarBackground } from "@/components/ui/LidarBackground";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquareDot,
  FileText,
  Cpu,
  Database,
  Zap,
  ArrowRight,
  Activity,
  GitBranch,
  Layers3,
  ScanLine,
} from "lucide-react";

const TIPS = [
  "Ask: \"What is the minimum laser point density for a valid vehicle cuboid?\"",
  "Ask: \"What are the ISO 8855 coordinate axis definitions?\"",
  "Ask: \"How should I handle heavily occluded pedestrians at range > 50m?\"",
  "Ask: \"What heading yaw tolerance is acceptable for Velodyne returns?\"",
];

export default function DashboardPage() {
  const { user, profile, role } = useAuth();
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const displayName = profile?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Engineer";

  const metrics = [
    {
      label: "RAG Pipeline",
      value: "Active",
      sub: "DeepSeek-V3 + BGE-M3",
      icon: <Cpu className="w-4 h-4 text-sky-400" />,
      statusColor: "bg-emerald-400",
    },
    {
      label: "Vector Store",
      value: "pgvector",
      sub: "Supabase PostgreSQL 17",
      icon: <Database className="w-4 h-4 text-cyan-400" />,
      statusColor: "bg-emerald-400",
    },
    {
      label: "Embedding Model",
      value: "BGE-M3",
      sub: "1024-dim dense vectors",
      icon: <Layers3 className="w-4 h-4 text-purple-400" />,
      statusColor: "bg-sky-400",
    },
    {
      label: "Retrieval Mode",
      value: "Hybrid",
      sub: "Dense + Cross-encoder rerank",
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      statusColor: "bg-emerald-400",
    },
  ];

  const quickActions = [
    {
      href: "/chat",
      icon: <MessageSquareDot className="w-5 h-5 text-sky-400" />,
      title: "Ask the AI Assistant",
      desc: "Query annotation SOPs and sensor specs with real-time RAG retrieval",
      accent: "rgba(14,165,233,0.08)",
      border: "rgba(14,165,233,0.2)",
      hoverBorder: "rgba(14,165,233,0.45)",
    },
    {
      href: "/documents",
      icon: <FileText className="w-5 h-5 text-emerald-400" />,
      title: "Upload Documents",
      desc: "Add PDFs, DOCX, or Markdown SOPs to the knowledge base for RAG indexing",
      accent: "rgba(52,211,153,0.06)",
      border: "rgba(52,211,153,0.15)",
      hoverBorder: "rgba(52,211,153,0.4)",
    },
  ];

  return (
    <div className="relative min-h-full space-y-6 p-1">
      {/* ── Hero band ─────────────────────────────────────────────── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #050d1a 0%, #0a1628 60%, #050d1a 100%)",
          border: "1px solid rgba(14,165,233,0.15)",
        }}
      >
        <LidarBackground opacity={0.12} />

        {/* Conic glow top */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 pointer-events-none"
          style={{
            background: "conic-gradient(from 180deg at 50% 0%, transparent 60%, rgba(14,165,233,0.15) 80%, transparent 100%)",
          }}
        />

        <div className="relative flex items-center justify-between px-7 py-7">
          {/* Text side */}
          <div className="space-y-3 max-w-lg">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-sky-500" />
              <span className="text-[10px] font-semibold tracking-widest text-sky-500 uppercase">
                ARIA V1 · LiDAR Perception Intelligence
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">
              Welcome back,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">
                {displayName}
              </span>
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed">
              Your RAG pipeline is live. Ask ARIA about 3D cuboid labeling rules, sensor
              extrinsics, occlusion standards, or any annotation SOP in your knowledge base.
            </p>

            {/* Rotating tip */}
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-md text-xs text-slate-300"
              style={{ background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.15)" }}
            >
              <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <span className="italic transition-all duration-500">{TIPS[tipIndex]}</span>
            </div>

            {/* Role badge */}
            {role && (
              <Badge
                variant="outline"
                className="border-slate-700 text-slate-400 text-[10px] font-mono"
              >
                <GitBranch className="w-3 h-3 mr-1" />
                {role} · {user?.email}
              </Badge>
            )}
          </div>

          {/* Vehicle wireframe */}
          <div className="hidden lg:block shrink-0 opacity-70">
            <VehicleWireframe width={260} height={186} />
          </div>
        </div>
      </div>

      {/* ── System metrics ────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
          System Status
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg px-4 py-3.5 flex items-start gap-3"
              style={{
                background: "#080f1e",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="mt-0.5 shrink-0">{m.icon}</div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-white">{m.value}</p>
                <p className="text-[10px] text-slate-500 truncate">{m.sub}</p>
              </div>
              <span className={`ml-auto mt-1 w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${m.statusColor}`} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
          Quick Actions
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group block rounded-xl px-5 py-5 transition-all duration-200"
              style={{
                background: a.accent,
                border: `1px solid ${a.border}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = a.hoverBorder)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = a.border)
              }
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {a.icon}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{a.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Architecture callout ───────────────────────────────────── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "#05080f",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
          V1 RAG Architecture
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500">
          {[
            "PDF / DOCX / MD",
            "→ Text Extraction",
            "→ Chunking",
            "→ BGE-M3 Embedding",
            "→ pgvector",
            "→ Cosine Search",
            "→ Cross-Encoder Rerank",
            "→ DeepSeek-V3",
            "→ Grounded Answer + Citations",
          ].map((step, i) => (
            <span
              key={i}
              className={
                step.startsWith("→")
                  ? "text-slate-700"
                  : i === 0
                  ? "text-slate-400"
                  : step.includes("DeepSeek") || step.includes("Citation") || step.includes("BGE") || step.includes("pgvector")
                  ? "text-sky-500"
                  : "text-slate-400"
              }
            >
              {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
