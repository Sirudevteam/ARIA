"use client";

import React from "react";
import { RetrievedChunkResult } from "@/lib/services/search";
import { X, FileText, Hash, Copy, Check, Award, ExternalLink } from "lucide-react";
import { useState } from "react";

interface CitationModalProps {
  citation: RetrievedChunkResult;
  citationIndex: number;
  onClose: () => void;
}

export function CitationModal({ citation, citationIndex, onClose }: CitationModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(citation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scorePercent = Math.round(((citation.rerank_score ?? citation.combined_score ?? 0)) * 100);
  const scoreColor =
    scorePercent >= 75 ? "#34d399" : scorePercent >= 50 ? "#0ea5e9" : "#f59e0b";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-lg rounded-xl overflow-hidden"
          style={{
            background: "rgba(5,13,26,0.97)",
            border: "1px solid rgba(14,165,233,0.25)",
            boxShadow: "0 0 60px rgba(14,165,233,0.12), 0 32px 64px rgba(0,0,0,0.7)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(14,165,233,0.12)" }}
          >
            <div className="flex items-center gap-3">
              {/* Citation number badge */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-sky-300 shrink-0"
                style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)" }}
              >
                {citationIndex}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Source Citation</p>
                <p className="text-[10px] text-slate-500">Document excerpt</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Document metadata */}
          <div
            className="px-5 py-3.5 space-y-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* Document title */}
            <div className="flex items-start gap-2.5">
              <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Document</p>
                <p className="text-sm font-semibold text-white leading-snug">
                  {citation.document_title || "Untitled Document"}
                </p>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              {citation.page != null && (
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-slate-600" />
                  <span className="text-[10px] text-slate-400 font-mono">Page {citation.page}</span>
                </div>
              )}

              {citation.version_number != null && (
                <div
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono text-sky-400"
                  style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}
                >
                  v{citation.version_number}
                </div>
              )}

              {/* Relevance score */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Award className="w-3 h-3" style={{ color: scoreColor }} />
                <span className="text-[10px] font-mono font-semibold" style={{ color: scoreColor }}>
                  {scorePercent}% relevance
                </span>
              </div>
            </div>

            {/* Score bar */}
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${scorePercent}%`, background: scoreColor }}
              />
            </div>
          </div>

          {/* Content excerpt */}
          <div className="px-5 py-4">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2.5">Content Excerpt</p>
            <div
              className="rounded-lg px-4 py-3.5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto"
              style={{
                background: "rgba(14,165,233,0.04)",
                border: "1px solid rgba(14,165,233,0.1)",
              }}
            >
              {citation.content}
            </div>
          </div>

          {/* Footer actions */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <p className="text-[9px] text-slate-700 font-mono">
              chunk_id: {citation.chunk_id?.slice(0, 16) ?? "—"}...
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: copied ? "rgba(52,211,153,0.1)" : "rgba(14,165,233,0.08)",
                border: `1px solid ${copied ? "rgba(52,211,153,0.3)" : "rgba(14,165,233,0.2)"}`,
                color: copied ? "#34d399" : "#7dd3fc",
              }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy excerpt"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
