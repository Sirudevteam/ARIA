"use client";

import React, { useState } from "react";
import { DocumentItem } from "@/types/document";
import { 
  FileText, 
  MoreHorizontal, 
  Download, 
  Eye, 
  UploadCloud, 
  Trash2, 
  Archive, 
  CheckSquare, 
  Square 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentsTableProps {
  documents: DocumentItem[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  onView: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onUploadNewVersion: (doc: DocumentItem) => void;
  onArchiveToggle: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
}

export function DocumentsTable({
  documents,
  selectedIds,
  onSelectToggle,
  onSelectAll,
  onView,
  onDownload,
  onUploadNewVersion,
  onArchiveToggle,
  onDelete,
}: DocumentsTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isAllSelected = documents.length > 0 && selectedIds.length === documents.length;

  return (
    <div className="w-full glass-panel rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900/60 border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-4 w-10">
                <button 
                  onClick={() => onSelectAll(!isAllSelected)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {isAllSelected ? <CheckSquare className="w-4 h-4 text-sky-400" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="px-4 py-3">Document Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {documents.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);
              return (
                <tr 
                  key={doc.id} 
                  className={cn(
                    "hover:bg-sky-500/[0.03] transition-colors group",
                    isSelected && "bg-sky-500/[0.06]"
                  )}
                >
                  <td className="p-4">
                    <button 
                      onClick={() => onSelectToggle(doc.id)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-sky-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-4 border-l-2 border-transparent group-hover:border-sky-400 transition-colors">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
                      <div>
                        <button 
                          onClick={() => onView(doc)} 
                          className="font-medium text-white hover:text-sky-400 text-left line-clamp-1 transition-colors"
                        >
                          {doc.title}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-sky-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-white/[0.04]">
                            v{doc.current_version_number || 1}
                          </span>
                          {doc.description && (
                            <span className="text-xs text-slate-500 line-clamp-1">{doc.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        doc.status === "READY" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" :
                        doc.status === "PROCESSING" || doc.status === "UPLOADED" ? "bg-amber-400 animate-pulse" :
                        doc.status === "ARCHIVED" ? "bg-slate-500" : "bg-sky-400"
                      )} />
                      <span className="text-xs text-slate-300 font-mono capitalize">
                        {doc.status.toLowerCase()}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-300">
                    {doc.project_name || "General"}
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-slate-400">
                    {formatSize(doc.file_size_bytes)}
                  </td>
                  <td className="px-4 py-4 text-right relative">
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openMenuId === doc.id && (
                      <div className="absolute right-8 top-10 w-48 bg-slate-900 border border-white/[0.08] rounded-xl shadow-2xl py-1 z-30 flex flex-col items-start text-xs backdrop-blur-xl">
                        <button onClick={() => { onView(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"><Eye className="w-3.5 h-3.5"/> View Details</button>
                        <button onClick={() => { onDownload(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"><Download className="w-3.5 h-3.5"/> Download</button>
                        <button onClick={() => { onUploadNewVersion(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"><UploadCloud className="w-3.5 h-3.5"/> Upload New Version</button>
                        <button onClick={() => { onArchiveToggle(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2"><Archive className="w-3.5 h-3.5"/> {doc.status === "ARCHIVED" ? "Unarchive" : "Archive"}</button>
                        <div className="w-full h-px bg-white/[0.06] my-1" />
                        <button onClick={() => { onDelete(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5"/> Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
