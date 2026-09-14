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
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-4 w-10">
                <button 
                  onClick={() => onSelectAll(!isAllSelected)}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {isAllSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="px-4 py-3">Document Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);
              return (
                <tr 
                  key={doc.id} 
                  className={cn(
                    "hover:bg-slate-50 transition-colors group",
                    isSelected && "bg-blue-50/60"
                  )}
                >
                  <td className="p-4">
                    <button 
                      onClick={() => onSelectToggle(doc.id)}
                      className="text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-4 border-l-2 border-transparent group-hover:border-blue-600 transition-colors">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <button 
                          onClick={() => onView(doc)} 
                          className="font-semibold text-slate-900 hover:text-blue-600 text-left line-clamp-1 transition-colors"
                        >
                          {doc.title}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
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
                        doc.status === "READY" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" :
                        doc.status === "PROCESSING" || doc.status === "UPLOADED" ? "bg-amber-500 animate-pulse" :
                        doc.status === "ARCHIVED" ? "bg-slate-400" : "bg-blue-600"
                      )} />
                      <span className="text-xs text-slate-700 font-mono font-medium capitalize">
                        {doc.status.toLowerCase()}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-700 font-medium">
                    {doc.project_name || "General"}
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-slate-500 font-medium">
                    {formatSize(doc.file_size_bytes)}
                  </td>
                  <td className="px-4 py-4 text-right relative">
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md hover:bg-slate-100 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openMenuId === doc.id && (
                      <div className="absolute right-8 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 flex flex-col items-start text-xs">
                        <button onClick={() => { onView(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"><Eye className="w-3.5 h-3.5 text-slate-400"/> View Details</button>
                        <button onClick={() => { onDownload(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"><Download className="w-3.5 h-3.5 text-slate-400"/> Download</button>
                        <button onClick={() => { onUploadNewVersion(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"><UploadCloud className="w-3.5 h-3.5 text-slate-400"/> Upload New Version</button>
                        <button onClick={() => { onArchiveToggle(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"><Archive className="w-3.5 h-3.5 text-slate-400"/> {doc.status === "ARCHIVED" ? "Unarchive" : "Archive"}</button>
                        <div className="w-full h-px bg-slate-100 my-1" />
                        <button onClick={() => { onDelete(doc); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"><Trash2 className="w-3.5 h-3.5"/> Delete</button>
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
