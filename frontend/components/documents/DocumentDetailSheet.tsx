"use client";

import React from "react";
import { DocumentDetail, DocumentItem } from "@/types/document";
import { 
  X, 
  Download, 
  UploadCloud, 
  Trash2, 
  Archive, 
  FileText, 
  Clock, 
  User, 
  HardDrive, 
  ShieldAlert 
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface DocumentDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  document: (DocumentDetail | DocumentItem) | null;
  onDownload: (doc: any) => void;
  onUploadNewVersion: (doc: any) => void;
  onArchiveToggle: (doc: any) => void;
  onDelete: (doc: any) => void;
}

export function DocumentDetailSheet({
  isOpen,
  onClose,
  document,
  onDownload,
  onUploadNewVersion,
  onArchiveToggle,
  onDelete,
}: DocumentDetailSheetProps) {
  if (!document) return null;

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const versions = "versions" in document && Array.isArray(document.versions) ? document.versions : [];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-slate-950 border-l border-white/[0.06] p-6 overflow-y-auto">
        <SheetHeader className="text-left pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold text-white truncate">{document.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-mono",
                  document.status === "READY" ? "bg-emerald-500/10 text-emerald-400" :
                  document.status === "PROCESSING" || document.status === "UPLOADED" ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"
                )}>
                  {document.status}
                </span>
                <span className="bg-slate-800 text-sky-300 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  v{document.current_version_number || 1}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <p className="text-xs text-slate-400 leading-relaxed">
            {document.description || "No description available for this document."}
          </p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono uppercase">Created</span>
              </div>
              <p className="text-xs text-slate-200 font-medium">{formatDate(document.created_at)}</p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <User className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono uppercase">Author</span>
              </div>
              <p className="text-xs text-slate-200 font-medium">{document.author || document.uploaded_by_name || "System"}</p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono uppercase">Size</span>
              </div>
              <p className="text-xs text-slate-200 font-medium">{formatSize(document.file_size_bytes)}</p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono uppercase">Project</span>
              </div>
              <p className="text-xs text-slate-200 truncate font-medium">{document.project_name || "General"}</p>
            </div>
          </div>

          {/* Version History */}
          {versions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Version History ({versions.length})
              </h4>
              <div className="space-y-2">
                {versions.map((ver) => (
                  <div key={ver.id} className="p-3 rounded-xl bg-slate-900/40 border border-white/[0.04] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-sky-400">v{ver.version_number}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ver.change_summary || "Updated content"}</p>
                    </div>
                    <span className="text-[10px] text-slate-500">{formatDate(ver.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/[0.06] space-y-2">
            <button
              onClick={() => onDownload(document)}
              className="w-full py-2 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-medium flex items-center justify-center gap-2 border border-sky-400/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download Document
            </button>
            <button
              onClick={() => onUploadNewVersion(document)}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 border border-white/[0.06] transition-all"
            >
              <UploadCloud className="w-3.5 h-3.5" /> Upload New Version
            </button>
            <button
              onClick={() => onArchiveToggle(document)}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 border border-white/[0.06] transition-all"
            >
              <Archive className="w-3.5 h-3.5" /> {document.status === "ARCHIVED" ? "Unarchive Document" : "Archive Document"}
            </button>
            <button
              onClick={() => onDelete(document)}
              className="w-full py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium flex items-center justify-center gap-2 border border-red-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Document
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
