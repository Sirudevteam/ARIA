"use client";

import { MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  dateCategory: "Today" | "Previous 7 Days" | "Older";
  messages: any[];
}

interface ConversationSidebarProps {
  sessions: ConversationSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  className?: string;
}

export function ConversationSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  searchQuery,
  onSearchChange,
  className = "",
}: ConversationSidebarProps) {
  const categories = ["Today", "Previous 7 Days", "Older"] as const;

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full glass-panel border-r border-white/[0.06] ${className}`}>
      <div className="p-4 border-b border-white/[0.06] space-y-4">
        <Button
          onClick={onNewChat}
          className="w-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white shadow-lg shadow-sky-500/20 border-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 bg-slate-900/50 border-white/[0.06] text-xs h-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {categories.map((category) => {
          const categorySessions = filteredSessions.filter(
            (s) => s.dateCategory === category
          );

          if (categorySessions.length === 0) return null;

          return (
            <div key={category} className="space-y-2">
              <h3 className="px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {category}
              </h3>
              <div className="space-y-1">
                {categorySessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`group relative flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        isActive
                          ? "bg-slate-800/80 text-sky-400"
                          : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-1/2 bg-sky-400 rounded-r-full shadow-[0_0_8px_#38bdf8]" />
                      )}
                      <div className="flex items-center gap-2 overflow-hidden">
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="text-xs truncate font-medium">
                          {session.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.messages.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-500'}`}>
                            {session.messages.length}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
