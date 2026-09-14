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
        return <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" title="Ready" />;
      case "PROCESSING":
      case "UPLOADED":
        return <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Processing" />;
      case "ARCHIVED":
        return <span className="w-2 h-2 rounded-full bg-slate-400" title="Archived" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-blue-600" title={document.status} />;
    }
  };

  return (
    <div 
      className="bg-white border border-slate-200 rounded-xl hover:border-blue-300 p-5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-md shadow-xs group"
      onClick={() => onView(document)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
          <FileText className="w-5 h-5" />
        </div>
        <button 
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
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
        <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1.5 group-hover:text-blue-600 transition-colors">
          {document.title}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
          {document.description || "No description provided for this engineering specification."}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3 mt-auto">
        <div className="flex items-center gap-2">
          <span className="bg-blue-50 px-2 py-0.5 rounded text-[11px] font-mono text-blue-700 border border-blue-200 font-bold">
            v{document.current_version_number || 1}
          </span>
          <span className="truncate max-w-[100px] text-slate-600 font-medium" title={document.project_name}>
            {document.project_name || "General"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">{formatSize(document.file_size_bytes)}</span>
          {getStatusBadge()}
        </div>
      </div>
    </div>
  );
}
