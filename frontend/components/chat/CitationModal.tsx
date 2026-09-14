"use client";

import { Copy, Check, FileText } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CitationData {
  title: string;
  page?: string | number;
  version?: string;
  relevance: number;
  excerpt: string;
}

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: CitationData | null;
}

export function CitationModal({ isOpen, onClose, citation }: CitationModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (citation?.excerpt) {
      navigator.clipboard.writeText(citation.excerpt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!citation) return null;

  const relevanceColor = 
    citation.relevance >= 75 ? "bg-emerald-500" : 
    citation.relevance >= 50 ? "bg-blue-600" : "bg-amber-500";
    
  const relevanceTextColor = 
    citation.relevance >= 75 ? "text-emerald-600" : 
    citation.relevance >= 50 ? "text-blue-600" : "text-amber-600";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-white border-slate-200 shadow-xl overflow-hidden p-0">
        <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {citation.title}
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs">
                {citation.page && (
                  <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 shadow-2xs font-medium">
                    Page {citation.page}
                  </Badge>
                )}
                {citation.version && (
                  <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-medium">
                    v{citation.version}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <span className={`text-2xl font-mono font-bold ${relevanceTextColor}`}>
                {citation.relevance}%
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Relevance
              </span>
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div 
                  className={`h-full ${relevanceColor} rounded-full`}
                  style={{ width: `${citation.relevance}%` }}
                />
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-5 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Source Excerpt
            </h4>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCopy}
              className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Copied</>
              ) : (
                <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy</>
              )}
            </Button>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[300px] overflow-y-auto">
            <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
              {citation.excerpt}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
