"use client";

import { useEffect, useRef } from "react";
import { Send, Square, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  inputValue: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming: boolean;
  streamingStatusText?: string;
  selectedProject: string;
  onProjectChange: (projId: string) => void;
  projects: { id: string; name: string }[];
  onToggleSettings: () => void;
  showSettings: boolean;
}

export function ChatInput({
  inputValue,
  onInputChange,
  onSend,
  onStop,
  isStreaming,
  streamingStatusText,
  selectedProject,
  onProjectChange,
  projects,
  onToggleSettings,
  showSettings,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isStreaming) {
        onSend();
      }
    }
  };

  return (
    <div className="flex flex-col glass-panel rounded-xl border border-white/[0.08] shadow-lg shadow-black/20 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/40 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Select value={selectedProject} onValueChange={(val) => onProjectChange(val ?? "")}>
            <SelectTrigger className="h-7 w-[125px] sm:w-[180px] bg-slate-800/50 border-white/[0.06] text-xs focus:ring-1 focus:ring-sky-500/50 shrink-0">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isStreaming && streamingStatusText && (
            <div className="flex items-center gap-1.5 animate-fade-in min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 aria-scan-pulse shrink-0" />
              <span className="text-[10px] text-sky-400 font-mono tracking-tight truncate max-w-[100px] sm:max-w-xs">
                {streamingStatusText}
              </span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSettings}
          className={`h-7 px-2 text-xs shrink-0 ${showSettings ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-300"}`}
          aria-label="Toggle RAG Settings"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </div>

      {/* Input Area */}
      <div className="relative flex items-end p-2 gap-2 bg-slate-950/50">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          className="flex-1 min-h-[44px] max-h-[200px] bg-transparent border-0 focus-visible:ring-0 resize-none px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600"
          rows={1}
        />
        
        <div className="flex items-center shrink-0 mb-1 mr-1">
          {isStreaming ? (
            <Button
              onClick={onStop}
              size="icon"
              className="h-9 w-9 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (inputValue.trim()) onSend();
              }}
              disabled={!inputValue.trim()}
              size="icon"
              className="h-9 w-9 rounded-lg bg-sky-500 hover:bg-sky-400 text-white disabled:bg-slate-800 disabled:text-slate-600 transition-colors"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Bottom Hint - Desktop only */}
      <div className="hidden sm:flex px-4 py-1.5 bg-slate-950 justify-end">
        <span className="text-[10px] text-slate-600 font-medium">
          Enter to send <span className="mx-1 opacity-50">·</span> Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}
