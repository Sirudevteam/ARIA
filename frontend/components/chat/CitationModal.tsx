"use client";

import React, { useState } from "react";
import { RetrievedChunkResult } from "@/lib/services/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, Check, Copy, ExternalLink, FileText, Sparkles, X } from "lucide-react";

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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-2xl border-slate-800 bg-slate-900 shadow-2xl overflow-hidden rounded-xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <CardHeader className="border-b border-slate-800 bg-slate-950/60 pb-3 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Bookmark className="w-3.5 h-3.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  {citationIndex !== undefined ? `Citation [${citationIndex}]` : "Source Citation Details"}
                  <Badge variant="outline" className="border-slate-700 bg-slate-950 font-mono text-[10px] text-slate-400">
                    v{citation.version_number}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <FileText className="w-3 h-3 text-sky-400" />
                  {citation.document_title}
                </CardDescription>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        {/* Modal Body */}
        <CardContent className="p-5 space-y-4 text-xs">
          {/* Metadata Badges Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {citation.page && (
              <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-300 font-mono text-[11px]">
                Page {citation.page}
              </Badge>
            )}

            {citation.section && (
              <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-300 text-[11px]">
                § {citation.section}
              </Badge>
            )}

            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-950/60 text-emerald-300 font-mono text-[11px] flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {relevancePct}% Relevance Match
            </Badge>

            <Badge variant="outline" className="border-slate-800 bg-slate-950 font-mono text-[10px] text-slate-500">
              Type: {citation.doc_type}
            </Badge>
          </div>

          {/* Verbatim Chunk Content Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Verbatim Verified Context Snippet:</span>
              <button
                onClick={handleCopyChunk}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/90 text-slate-200 font-sans leading-relaxed text-xs max-h-60 overflow-y-auto">
              {citation.content}
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
            <span>Chunk ID: {citation.chunk_id}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 px-3 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
