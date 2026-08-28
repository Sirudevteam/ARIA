"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { documentsService } from "@/lib/services/documents";
import { VehicleWireframe } from "@/components/ui/VehicleWireframe";
import { LidarBackground } from "@/components/ui/LidarBackground";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquareDot,
  FileText,
  Cpu,
  Database,
  Layers3,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Shield,
  ScanLine,
} from "lucide-react";

const EXAMPLE_QUESTIONS = [
  "What is the correct rule for partially occluded vehicles?",
  "How should a 3D cuboid be placed?",
  "What are the common annotation errors?",
  "What is the QC procedure for an annotation?",
];

export default function DashboardPage() {
  const { user, profile, role } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{ total_documents: number; total_chunks: number; rag_status: string }>({
    total_documents: 0,
    total_chunks: 0,
    rag_status: "Active",
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await documentsService.getStats();
        setStats(res);
      } catch (err) {
        console.warn("Failed to load dashboard stats", err);
      } finally {
        setIsLoadingStats(false);
      }
    }
    loadStats();
  }, []);

  const handleAskQuestion = (question: string) => {
    router.push(`/chat?q=${encodeURIComponent(question)}`);
  };

  const metrics = [
    {
      label: "Knowledge Documents",
      value: isLoadingStats ? "..." : String(stats.total_documents),
      sub: "Active SOPs & specs",
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      statusColor: "bg-emerald-400",
    },
    {
      label: "Indexed Chunks",
      value: isLoadingStats ? "..." : String(stats.total_chunks),
      sub: "1024d BGE-M3 vectors",
      icon: <Layers3 className="w-4 h-4 text-purple-400" />,
      statusColor: "bg-purple-400",
    },
    {
      label: "RAG Status",
      value: "Active",
      sub: "DeepSeek-V3 · pgvector",
      icon: <Cpu className="w-4 h-4 text-sky-400" />,
      statusColor: "bg-emerald-400",
    },
  ];

  return (
    <div className="relative min-h-full space-y-6 p-1">
      {/* ── Hero section ─────────────────────────────────────────────── */}
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

        <div className="relative flex items-center justify-between px-7 py-8">
          {/* Text side */}
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-sky-400" />
              <span className="text-[10px] font-bold tracking-widest text-sky-400 uppercase">
                ARIA · Annotation RAG Intelligent Assistant
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              3D LiDAR Knowledge Assistant
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Ask questions about annotation guidelines, object classes, occlusion, QC and validation.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link href="/chat">
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer"
                  style={{
                    background: "#0ea5e9",
                    boxShadow: "0 0 20px rgba(14,165,233,0.35)",
                  }}
                >
                  <MessageSquareDot className="w-4 h-4" />
                  <span>Ask ARIA</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>

              <Link href="/documents">
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Knowledge Base</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Vehicle wireframe */}
          <div className="hidden lg:block shrink-0 opacity-75">
            <VehicleWireframe width={270} height={190} />
          </div>
        </div>
      </div>

      {/* ── Live metrics row ────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
          Live System Metrics
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <p className="text-base font-bold text-white">{m.value}</p>
                <p className="text-[10px] text-slate-500 truncate">{m.sub}</p>
              </div>
              <span className={`ml-auto mt-1 w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${m.statusColor}`} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Example Questions Grid ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Example Annotation Questions
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleAskQuestion(q)}
              className="group p-4 rounded-xl text-left transition-all flex items-center justify-between"
              style={{
                background: "rgba(14,165,233,0.04)",
                border: "1px solid rgba(14,165,233,0.12)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "rgba(14,165,233,0.35)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "rgba(14,165,233,0.12)")
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-sky-400 shrink-0"
                  style={{ background: "rgba(14,165,233,0.1)" }}
                >
                  0{idx + 1}
                </div>
                <span className="text-xs text-slate-200 group-hover:text-white font-medium transition">
                  {q}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      {/* ── RAG Architecture verification trace ─────────────────────── */}
      <div
        className="rounded-xl px-5 py-4"
        style={{
          background: "#05080f",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
          Verified RAG Pipeline Flow
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500">
          {[
            "User Query",
            "→ BGE-M3 Query Vector",
            "→ pgvector Cosine Search",
            "→ Cross-Encoder Reranker",
            "→ Precision Context Assembly",
            "→ DeepSeek-V3 LLM",
            "→ Grounded Answer + Citations",
          ].map((step, i) => (
            <span
              key={i}
              className={
                step.startsWith("→")
                  ? "text-slate-700"
                  : step.includes("DeepSeek") || step.includes("Citations") || step.includes("BGE") || step.includes("pgvector")
                  ? "text-sky-400"
                  : "text-slate-300"
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
