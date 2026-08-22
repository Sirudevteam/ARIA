"use client";

import React, { useState } from "react";
import { RetrievedChunkResult } from "@/lib/services/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bookmark,
  Check,
  Copy,
  FileText,
  Sparkles,
  X,
  Highlighter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface CitationModalProps {
  citation: RetrievedChunkResult | null;
  citationIndex?: number;
  onClose: () => void;
}

export function CitationModal({ citation, citationIndex, onClose }: CitationModalProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!citation) return null;

  const handleCopyChunk = () => {
    navigator.clipboard.writeText(citation.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const relevancePct = Math.round(
    ((citation.rerank_score ?? citation.combined_score) || 0) * 100
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Document Page Viewer Header ───────────────────────────────── */}
        <div className="border-b border-slate-800 bg-slate-950/80 px-5 py-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {citation.document_title}
                </h3>
                <Badge variant="outline" className="border-slate-700 bg-slate-950 font-mono text-[10px] text-slate-300">
                  v{citation.version_number}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                {citation.page ? (
                  <span className="font-semibold text-sky-400">Page {citation.page}</span>
                ) : (
                  <span>Verified Document Chunk</span>
                )}
                {citation.section && <span>· § {citation.section}</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Document Sheet / Highlighted Section Canvas ─────────────────── */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh] bg-slate-900/90 text-xs">
          {/* Visual Indicator Banner */}
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold uppercase tracking-wider text-[10px]">
              <Highlighter className="w-3.5 h-3.5" />
              Relevant section highlighted
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-950/60 text-emerald-300 font-mono text-[10px] flex items-center gap-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                {relevancePct}% Relevance Match
              </Badge>
              {citationIndex !== undefined && (
                <Badge variant="outline" className="border-sky-500/30 bg-sky-950/50 text-sky-300 font-mono text-[10px]">
                  Citation [{citationIndex}]
                </Badge>
              )}
            </div>
          </div>

          {/* Document Sheet Frame */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5 shadow-inner space-y-3 font-sans relative">
            {/* Page Header simulation */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-850 text-[10px] text-slate-500 font-mono">
              <span className="truncate">{citation.document_title}</span>
              <span>{citation.page ? `PAGE ${citation.page}` : "EXCERPT"}</span>
            </div>

            {/* Section Heading */}
            {citation.section && (
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                {citation.section}
              </h4>
            )}

            {/* ── Highlighted Section Box ──────────────────────────────── */}
            <div className="relative rounded-lg border-l-4 border-amber-400 bg-amber-500/10 p-3.5 text-slate-100 font-sans leading-relaxed text-xs sm:text-sm shadow-sm">
              <span className="text-amber-400 font-serif text-lg leading-none select-none mr-1 font-bold">
                &ldquo;
              </span>
              <span className="font-medium text-slate-100">
                {citation.content}
              </span>
              <span className="text-amber-400 font-serif text-lg leading-none select-none ml-1 font-bold">
                &rdquo;
              </span>
            </div>

            {/* Verified Footer Stamp */}
            <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3 h-3" /> Grounded pgvector + BGE-Reranker
              </span>
              <span>Chunk ID: {citation.chunk_id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* ── Modal Footer Action Bar ──────────────────────────────────── */}
        <div className="border-t border-slate-800 bg-slate-950/90 px-5 py-3 flex items-center justify-between text-xs">
          <button
            onClick={handleCopyChunk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition font-medium text-xs cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied Quote</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Highlighted Text</span>
              </>
            )}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
