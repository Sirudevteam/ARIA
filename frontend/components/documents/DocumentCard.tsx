"use client";

import React from "react";
import { DocumentItem } from "@/types/document";
import { FileText, MoreVertical, Download, Eye, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
  document: DocumentItem;
  onView: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onArchiveToggle: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

export function DocumentCard({
  document,
  onView,
  onDownload,
  onArchiveToggle,
  onDelete,
}: DocumentCardProps) {
  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusBadge = () => {
    switch (document.status) {
      case "READY":
        return <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="Ready" />;
      case "PROCESSING":
      case "UPLOADED":
        return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Processing" />;
      case "ARCHIVED":
        return <span className="w-2 h-2 rounded-full bg-slate-500" title="Archived" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-sky-400" title={document.status} />;
    }
  };

  return (
    <div 
      className="glass-card border border-white/[0.06] hover:border-sky-400/30 p-5 flex flex-col justify-between cursor-pointer transition-all hover:bg-sky-500/5 group"
      onClick={() => onView(document)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
          <FileText className="w-5 h-5" />
        </div>
        <button 
          className="p-1.5 text-slate-500 hover:text-slate-300 rounded-md hover:bg-slate-800 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onView(document);
          }}
          title="Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 mb-4">
        <h3 className="text-base font-semibold text-white line-clamp-1 mb-1.5 group-hover:text-sky-300 transition-colors">
          {document.title}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {document.description || "No description provided for this engineering specification."}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 border-t border-white/[0.06] pt-3 mt-auto">
        <div className="flex items-center gap-2">
          <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[11px] font-mono text-sky-300 border border-white/[0.04]">
            v{document.current_version_number || 1}
          </span>
          <span className="truncate max-w-[100px] text-slate-400" title={document.project_name}>
            {document.project_name || "General"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px]">{formatSize(document.file_size_bytes)}</span>
          {getStatusBadge()}
        </div>
      </div>
    </div>
  );
}
