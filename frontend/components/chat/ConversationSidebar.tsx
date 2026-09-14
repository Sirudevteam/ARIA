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
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 ${className}`}>
      <div className="p-4 border-b border-slate-100 space-y-3">
        <Button
          onClick={onNewChat}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 bg-slate-50 border-slate-200 text-xs h-9 text-slate-900 placeholder:text-slate-400 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {categories.map((category) => {
          const categorySessions = filteredSessions.filter(
            (s) => s.dateCategory === category
          );

          if (categorySessions.length === 0) return null;

          return (
            <div key={category} className="space-y-1.5">
              <h3 className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {category}
              </h3>
              <div className="space-y-0.5">
                {categorySessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                      )}
                      <div className="flex items-center gap-2 overflow-hidden">
                        <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="text-xs truncate">
                          {session.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {session.messages.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {session.messages.length}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 text-slate-400 transition-opacity p-1 rounded hover:bg-red-50"
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
