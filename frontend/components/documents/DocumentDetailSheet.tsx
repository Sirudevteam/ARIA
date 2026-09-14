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
      <SheetContent side="right" className="w-full sm:max-w-md bg-white border-l border-slate-200 p-6 overflow-y-auto">
        <SheetHeader className="text-left pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold text-slate-900 truncate">{document.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold",
                  document.status === "READY" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                  document.status === "PROCESSING" || document.status === "UPLOADED" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600"
                )}>
                  {document.status}
                </span>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  v{document.current_version_number || 1}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <p className="text-xs text-slate-600 leading-relaxed font-normal">
            {document.description || "No description available for this document."}
          </p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-mono uppercase font-semibold">Created</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold">{formatDate(document.created_at)}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-mono uppercase font-semibold">Author</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold">{document.author || document.uploaded_by_name || "System"}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-mono uppercase font-semibold">Size</span>
              </div>
              <p className="text-xs text-slate-800 font-semibold">{formatSize(document.file_size_bytes)}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-mono uppercase font-semibold">Project</span>
              </div>
              <p className="text-xs text-slate-800 truncate font-semibold">{document.project_name || "General"}</p>
            </div>
          </div>

          {/* Version History */}
          {versions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Version History ({versions.length})
              </h4>
              <div className="space-y-2">
                {versions.map((ver) => (
                  <div key={ver.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-blue-700 font-bold">v{ver.version_number}</span>
                      <p className="text-[11px] text-slate-600 mt-0.5">{ver.change_summary || "Updated content"}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{formatDate(ver.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <button
              onClick={() => onDownload(document)}
              className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 border border-blue-200 transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Download Document
            </button>
            <button
              onClick={() => onUploadNewVersion(document)}
              className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-200 transition-all shadow-2xs"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-500" /> Upload New Version
            </button>
            <button
              onClick={() => onArchiveToggle(document)}
              className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-200 transition-all shadow-2xs"
            >
              <Archive className="w-3.5 h-3.5 text-slate-500" /> {document.status === "ARCHIVED" ? "Unarchive Document" : "Archive Document"}
            </button>
            <button
              onClick={() => onDelete(document)}
              className="w-full py-2 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center justify-center gap-2 border border-red-200 transition-all shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Document
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
