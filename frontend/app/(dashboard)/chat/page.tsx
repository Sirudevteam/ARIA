"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { chatService, ChatMessage, TokenUsage } from "@/lib/services/chat";
import { ProjectSummary } from "@/types/document";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { CitationModal } from "@/components/chat/CitationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  FileText,
  Bookmark,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  BrainCircuit,
  ArrowUpRight,
  Square,
  Copy,
  Check,
  Plus,
  MessageSquare,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  AlertCircle,
  Menu,
  X,
  Clock,
  Layers,
  Folder,
} from "lucide-react";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoningContent?: string;
  citations?: RetrievedChunkResult[];
  model?: string;
  usage?: TokenUsage;
  latencyMs?: number;
  timestamp: string;
  feedback?: "like" | "dislike" | null;
  isError?: boolean;
}

interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  dateCategory: "Today" | "Previous 7 Days" | "Older";
  messages: MessageItem[];
}

const DEFAULT_PROMPT_SUGGESTIONS = [
  {
    title: "QC Rules & Occlusion",
    query: "What is occlusion and what are the categorization standards for 3D annotation?",
  },
  {
    title: "Cuboid Fitting & Yaw",
    query: "What are the 3D bounding box rules for vehicles and yaw angle alignment?",
  },
  {
    title: "Tracking & Point Density",
    query: "What is the minimum laser point density threshold required per vehicle object?",
  },
  {
    title: "ISO 8855 Coordinates",
    query: "What standard coordinate orientation do LiDAR sensors use according to ISO 8855?",
  },
];

const STORAGE_KEY = "aria_chat_sessions_v2";

export default function ChatPage() {
  const { user } = useAuth();

  // Sessions state (loaded from localStorage on mount)
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Projects state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Chat UI state
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatusText, setStreamingStatusText] = useState("Retrieving context...");
  const [showConfig, setShowConfig] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [activeCitationModal, setActiveCitationModal] = useState<{ citation: RetrievedChunkResult; index: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Hyperparameters
  const [candidateK, setCandidateK] = useState<number>(20);
  const [topK, setTopK] = useState<number>(5);
  const [minThreshold, setMinThreshold] = useState<number>(0.25);
  const [temperature, setTemperature] = useState<number>(0.2);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          setIsLoaded(true);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default initial session
    const initialSession: ConversationSession = {
      id: `session-${Date.now()}`,
      title: "New Conversation",
      createdAt: new Date().toISOString(),
      dateCategory: "Today",
      messages: [],
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
    setIsLoaded(true);
  }, []);

  // Persist sessions to localStorage
  useEffect(() => {
    if (isLoaded && sessions.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      } catch (err) {
        console.error("Failed to save chat sessions to localStorage:", err);
      }
    }
  }, [sessions, isLoaded]);

  // Load projects
  useEffect(() => {
    async function loadProjects() {
      const projs = await searchService.getProjects();
      setProjects(projs);
    }
    loadProjects();
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, isStreaming]);

  // Active session helper
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Group sessions by date
  const todaySessions = sessions.filter((s) => s.dateCategory === "Today");
  const previousSessions = sessions.filter((s) => s.dateCategory !== "Today");

  // Create new chat session
  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ConversationSession = {
      id: newId,
      title: "New Conversation",
      createdAt: new Date().toISOString(),
      dateCategory: "Today",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMobileSidebarOpen(false);
    setErrorBanner(null);
  };

  // Delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh: ConversationSession = {
          id: `session-${Date.now()}`,
          title: "New Conversation",
          createdAt: new Date().toISOString(),
          dateCategory: "Today",
          messages: [],
        };
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (sessionId === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Copy text handler
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Feedback handler (thumbs up / down)
  const handleFeedback = (messageId: string, feedbackType: "like" | "dislike") => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id === messageId) {
                return {
                  ...m,
                  feedback: m.feedback === feedbackType ? null : feedbackType,
                };
              }
              return m;
            }),
          };
        }
        return s;
      })
    );
  };

  // Stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingStatusText("");
    }
  };

  // Send message or Regenerate
  const handleSendMessage = useCallback(
    async (queryText?: string, targetAssistantMsgId?: string) => {
      const query = (queryText || inputValue).trim();
      if (!query || isStreaming) return;

      setErrorBanner(null);
      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = targetAssistantMsgId || `asst-${Date.now()}`;
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (!targetAssistantMsgId) {
        // Add new user & assistant message pair
        const newUserMessage: MessageItem = {
          id: userMsgId,
          role: "user",
          content: query,
          timestamp,
        };

        const newAssistantMessage: MessageItem = {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          citations: [],
          timestamp,
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              const updatedTitle =
                s.messages.length === 0
                  ? query.slice(0, 30) + (query.length > 30 ? "..." : "")
                  : s.title;
              return {
                ...s,
                title: updatedTitle,
                messages: [...s.messages, newUserMessage, newAssistantMessage],
              };
            }
            return s;
          })
        );
      } else {
        // Regenerating existing assistant message
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === targetAssistantMsgId
                    ? { ...m, content: "", citations: [], isError: false }
                    : m
                ),
              };
            }
            return s;
          })
        );
      }

      setInputValue("");
      setIsStreaming(true);
      setStreamingStatusText("Retrieving verified perception context (Hybrid + Reranker)...");

      // Extract conversation history
      const historyPayload: ChatMessage[] = messages
        .filter((m) => m.id !== targetAssistantMsgId && !m.isError)
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      abortControllerRef.current = new AbortController();
      const startTime = performance.now();

      try {
        await chatService.streamChatCompletion(
          {
            query,
            project_id: selectedProject || undefined,
            conversation_history: historyPayload,
            candidate_k: candidateK,
            top_k: topK,
            min_relevance_threshold: minThreshold,
            temperature,
          },
          {
            onCitations: (citations) => {
              setStreamingStatusText("Synthesizing grounded answer with DeepSeek...");
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === activeSessionId) {
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, citations } : m
                      ),
                    };
                  }
                  return s;
                })
              );
            },
            onDelta: (delta, reasoningDelta) => {
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === activeSessionId) {
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              content: m.content + delta,
                              reasoningContent: reasoningDelta
                                ? (m.reasoningContent || "") + reasoningDelta
                                : m.reasoningContent,
                            }
                          : m
                      ),
                    };
                  }
                  return s;
                })
              );
            },
            onDone: (usage) => {
              const latencyMs = Math.round(performance.now() - startTime);
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === activeSessionId) {
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              usage,
                              latencyMs,
                              model: "deepseek-chat",
                            }
                          : m
                      ),
                    };
                  }
                  return s;
                })
              );
              setIsStreaming(false);
              setStreamingStatusText("");
            },
            onError: (err) => {
              setErrorBanner(err.message);
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === activeSessionId) {
                    return {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              content:
                                m.content ||
                                "⚠️ Failed to generate grounded response. Please verify backend connection or check API keys.",
                              isError: true,
                            }
                          : m
                      ),
                    };
                  }
                  return s;
                })
              );
              setIsStreaming(false);
              setStreamingStatusText("");
            },
          },
          abortControllerRef.current.signal
        );
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setErrorBanner((err as Error).message);
        }
      } finally {
        setIsStreaming(false);
        setStreamingStatusText("");
      }
    },
    [inputValue, isStreaming, messages, activeSessionId, selectedProject, candidateK, topK, minThreshold, temperature]
  );

  // Regenerate last response handler
  const handleRegenerate = (assistantMsgIndex: number) => {
    if (isStreaming) return;
    const userMsg = messages[assistantMsgIndex - 1];
    const asstMsg = messages[assistantMsgIndex];
    if (userMsg && userMsg.role === "user" && asstMsg) {
      handleSendMessage(userMsg.content, asstMsg.id);
    }
  };

  // Click on citation link inside Markdown text handler
  const handleCitationClick = (citationNumber: number, citationsList?: RetrievedChunkResult[]) => {
    const list = citationsList || [];
    const targetIdx = citationNumber - 1;
    if (list[targetIdx]) {
      setActiveCitationModal({ citation: list[targetIdx], index: citationNumber });
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col max-w-7xl mx-auto p-2 md:p-3 space-y-2 select-text">
      {/* ── Top Automotive Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 px-2 bg-slate-950/40 rounded-t-xl">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm shadow-sky-500/10">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                3D LIDAR AI ASSISTANT
              </h1>
              <Badge variant="outline" className="border-sky-500/40 bg-sky-950/40 text-sky-300 text-[10px] py-0 hidden sm:inline-flex">
                DeepSeek-V3 · R1
              </Badge>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-[10px] py-0 hidden sm:inline-flex">
                BGE-M3 + Reranker
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Autonomous Driving Data Annotation & QC Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Project filter */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="h-7 rounded-md bg-slate-950 border border-slate-800 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">All Authorized Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Settings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className={`h-7 px-2 text-xs gap-1 border-slate-800 ${showConfig ? "bg-sky-500/10 text-sky-400 border-sky-500/30" : "text-slate-300"}`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Settings Tuning Drawer */}
      {showConfig && (
        <Card className="border-slate-800 bg-slate-900/90 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs shadow-xl animate-in fade-in duration-100">
          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">Candidate Chunks (k1)</label>
            <input
              type="number"
              value={candidateK}
              onChange={(e) => setCandidateK(Number(e.target.value))}
              min={5}
              max={50}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">Top Citations (k2)</label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              min={1}
              max={10}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">Min Relevance Filter ({Math.round(minThreshold * 100)}%)</label>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={minThreshold}
              onChange={(e) => setMinThreshold(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">Temperature ({temperature})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>
        </Card>
      )}

      {/* Error Banner Alert */}
      {errorBanner && (
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-red-200 font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 2-Column Split: Conversations on Left, AI Assistant on Right ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0 relative">
        {/* Left Panel: Conversations Sidebar */}
        <Card
          className={`${
            mobileSidebarOpen ? "absolute inset-0 z-30 flex" : "hidden"
          } md:flex md:static md:col-span-3 flex-col border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden rounded-xl`}
        >
          <div className="p-3 border-b border-slate-800/80 space-y-2">
            <Button
              onClick={handleNewChat}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold py-2 rounded-lg shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              + New Chat
            </Button>
          </div>

          {/* Conversations Session List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
            {/* Today */}
            {todaySessions.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2">
                  Today
                </span>
                <div className="mt-1 space-y-0.5">
                  {todaySessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition text-xs ${
                        session.id === activeSessionId
                          ? "bg-sky-500/15 border border-sky-500/30 text-white font-medium shadow-sm"
                          : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            session.id === activeSessionId ? "text-sky-400" : "text-slate-500"
                          }`}
                        />
                        <span className="truncate">{session.title}</span>
                      </div>

                      {sessions.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                          title="Delete thread"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Days */}
            {previousSessions.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2">
                  Previous 7 Days
                </span>
                <div className="mt-1 space-y-0.5">
                  {previousSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setActiveSessionId(session.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition text-xs ${
                        session.id === activeSessionId
                          ? "bg-sky-500/15 border border-sky-500/30 text-white font-medium shadow-sm"
                          : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            session.id === activeSessionId ? "text-sky-400" : "text-slate-500"
                          }`}
                        />
                        <span className="truncate">{session.title}</span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                        title="Delete thread"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right Panel: AI Assistant Main Canvas */}
        <Card className="col-span-1 md:col-span-9 flex flex-col border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden rounded-xl relative">
          {/* Subtle 3D LiDAR Grid background accent */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

          {/* Top Status Header */}
          <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50 relative z-10">
            <div>
              <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-sky-400" />
                AI Assistant
              </h2>
              <p className="text-[10px] text-slate-400">
                Ask anything about annotation & QC
              </p>
            </div>

            <Badge variant="outline" className="border-slate-800 bg-slate-950 font-mono text-[10px] text-slate-400">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 relative z-10">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    Ask anything about annotation & QC
                  </h3>
                  <p className="text-xs text-slate-400">
                    Grounded directly in verified SOPs, ISO 8855 standards, and point cloud calibration schemas.
                  </p>
                </div>

                {/* Prompt Suggestions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl pt-2">
                  {DEFAULT_PROMPT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.query)}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800/80 hover:border-sky-500/40 text-left transition text-xs flex flex-col gap-1 group shadow-sm"
                    >
                      <span className="font-semibold text-slate-200 group-hover:text-sky-400 transition flex items-center justify-between">
                        {item.title}
                        <ArrowUpRight className="w-3 h-3 opacity-60" />
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-2">
                        {item.query}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, mIdx) => (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  {/* Author Label */}
                  <span className="text-[10px] font-semibold text-slate-400 px-1">
                    {msg.role === "user" ? "User:" : "AI:"}
                  </span>

                  {/* Main Bubble */}
                  <div
                    className={`rounded-2xl p-3.5 text-xs md:text-sm leading-relaxed max-w-[95%] md:max-w-[85%] shadow-sm ${
                      msg.role === "user"
                        ? "bg-sky-600 text-white rounded-tr-sm font-sans"
                        : "bg-slate-950/90 border border-slate-800/90 text-slate-100 rounded-tl-sm backdrop-blur"
                    }`}
                  >
                    {/* DeepSeek-R1 Reasoning Chain Accordion */}
                    {msg.reasoningContent && (
                      <div className="mb-2.5 rounded-md border border-purple-500/30 bg-purple-950/20 p-2 text-xs">
                        <button
                          onClick={() =>
                            setExpandedReasoning((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="flex items-center justify-between w-full font-medium text-purple-300 hover:text-purple-200"
                        >
                          <span className="flex items-center gap-1.5">
                            <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                            DeepSeek Reasoning Process
                          </span>
                          {expandedReasoning[msg.id] ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {expandedReasoning[msg.id] && (
                          <div className="mt-2 pt-2 border-t border-purple-500/20 text-purple-200/90 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                            {msg.reasoningContent}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Content (Markdown Rendered) */}
                    {msg.content ? (
                      <MarkdownRenderer
                        content={msg.content}
                        onCitationClick={(citNum) => handleCitationClick(citNum, msg.citations)}
                      />
                    ) : isStreaming && msg.role === "assistant" ? (
                      <div className="flex items-center gap-2 text-slate-400 py-1 font-mono text-xs">
                        <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-400" />
                        <span>{streamingStatusText}</span>
                      </div>
                    ) : null}

                    {/* ── 📄 Sources Card (Embedded Under AI Response) ── */}
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                          📄 Sources ({msg.citations.length} Verified Citations)
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, idx) => (
                            <button
                              key={c.chunk_id || idx}
                              onClick={() => setActiveCitationModal({ citation: c, index: idx + 1 })}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-850 text-[11px] text-slate-300 transition flex items-center gap-1.5 group shadow-sm cursor-pointer"
                              title="Click to view verified source chunk"
                            >
                              <Bookmark className="w-3 h-3 text-sky-400" />
                              <span className="font-medium group-hover:text-white transition">
                                {c.document_title}
                              </span>
                              {c.page && (
                                <span className="text-slate-400 font-mono">
                                  · p.{c.page}
                                </span>
                              )}
                              {c.section && (
                                <span className="text-slate-500 truncate max-w-[120px]">
                                  · {c.section}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Action Toolbar (Assistant Messages) */}
                  {msg.role === "assistant" && msg.content && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1 font-mono">
                      {msg.latencyMs && <span>{msg.latencyMs}ms</span>}
                      {msg.model && <span>{msg.model}</span>}

                      <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                        {/* Copy button */}
                        <button
                          onClick={() => handleCopyText(msg.id, msg.content)}
                          className="p-1 hover:text-slate-300 transition rounded"
                          title="Copy answer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>

                        {/* Regenerate button */}
                        <button
                          onClick={() => handleRegenerate(mIdx)}
                          className="p-1 hover:text-slate-300 transition rounded"
                          title="Regenerate response"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>

                        {/* Thumbs up */}
                        <button
                          onClick={() => handleFeedback(msg.id, "like")}
                          className={`p-1 transition rounded ${
                            msg.feedback === "like"
                              ? "text-emerald-400 font-bold"
                              : "hover:text-slate-300"
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>

                        {/* Thumbs down */}
                        <button
                          onClick={() => handleFeedback(msg.id, "dislike")}
                          className={`p-1 transition rounded ${
                            msg.feedback === "dislike"
                              ? "text-red-400 font-bold"
                              : "hover:text-slate-300"
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.role === "user" && (
                    <span className="text-[10px] text-slate-500 mr-1 font-mono">
                      {msg.timestamp}
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Bottom Input Bar ────────────────────────────────────────── */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/70 backdrop-blur relative z-10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything about occlusion, 3D cuboid fitting, calibration rules..."
                disabled={isStreaming}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition"
              />

              {isStreaming ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleStopGeneration}
                  className="h-10 px-4 gap-1.5 text-xs font-medium rounded-xl shadow-lg"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="h-10 px-4 gap-1.5 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </Button>
              )}
            </form>
          </div>
        </Card>
      </div>

      {/* ── Citation Detail Modal ─────────────────────────────────────── */}
      <CitationModal
        citation={activeCitationModal?.citation || null}
        citationIndex={activeCitationModal?.index}
        onClose={() => setActiveCitationModal(null)}
      />
    </div>
  );
}
