"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaggerChildren, SlideUp } from "@/components/ui/motion";

interface ChatSession {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

const starterPrompts = [
  "Rule for partially occluded vehicles?",
  "How should a 3D cuboid be placed?",
  "Common annotation errors & QC procedure",
];

export function RecentChats({ className }: { className?: string }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("aria_chat_sessions_v2");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Take up to 4 most recent
        setSessions(Array.isArray(parsed) ? parsed.slice(0, 4) : []);
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    }
  }, []);

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.round(diffMs / 60000);
      
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.round(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.round(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch {
      return "recently";
    }
  };

  const handlePromptClick = (prompt: string) => {
    router.push(`/chat?q=${encodeURIComponent(prompt)}`);
  };

  if (!mounted) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
        {sessions.length > 0 && (
          <Link href="/chat" className="text-sm text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {sessions.length > 0 ? (
        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sessions.map((session, i) => {
            const count = (session as any).messages?.length ?? session.messageCount ?? 0;
            const time = session.updatedAt || (session as any).createdAt || new Date().toISOString();

            return (
              <SlideUp key={session.id}>
                <Link
                  href={`/chat?session=${session.id}`}
                  className="flex items-start gap-3.5 p-4 rounded-xl bg-surface-2 border border-white/[0.04] hover:bg-slate-800/50 hover:border-white/[0.08] transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-surface-1 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-cyan-400 transition-colors mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate mb-1">
                      {session.title || "Untitled Session"}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <MessageSquare className="w-3 h-3 text-slate-600" />
                        {count} msgs
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {formatRelativeTime(time)}
                      </span>
                    </div>
                  </div>
                </Link>
              </SlideUp>
            );
          })}
        </StaggerChildren>
      ) : (
        <SlideUp>
          <div className="rounded-xl bg-surface-2 border border-white/[0.04] p-6">
            <p className="text-sm text-slate-400 mb-4">No recent sessions found. Ask ARIA about LiDAR SOPs:</p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {starterPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handlePromptClick(prompt)}
                  className="px-4 py-2 rounded-lg bg-surface-1 border border-white/[0.06] text-sm text-slate-300 hover:bg-slate-800 hover:text-white hover:border-sky-500/30 transition-all text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </SlideUp>
      )}
    </div>
  );
}
