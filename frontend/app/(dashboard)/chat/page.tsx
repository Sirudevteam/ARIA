"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { chatService, ChatMessage, TokenUsage } from "@/lib/services/chat";
import { ProjectSummary } from "@/types/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Eye,
  Plus,
  MessageSquare,
  Trash2,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
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
}

interface ConversationSession {
  id: string;
  title: string;
  createdAt: string;
  dateCategory: "Today" | "Previous 7 Days" | "Older";
  messages: MessageItem[];
}

const DEFAULT_SUGGESTIONS = [
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

const INITIAL_SESSIONS: ConversationSession[] = [
  {
    id: "session-qc-rules",
    title: "QC Rules & Occlusion",
    createdAt: new Date().toISOString(),
    dateCategory: "Today",
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "What is occlusion in 3D point cloud annotation?",
        timestamp: "10:14 AM",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "According to the perception guidelines, **occlusion** occurs when an object is partially or fully hidden from the sensor's line of sight by other objects or obstacles [Citation 1].\n\n### Occlusion Categories:\n- **Level 1 (0–20% Occluded)**: Mostly visible; annotate full 3D extent based on visible points.\n- **Level 2 (20–50% Occluded)**: Partially visible; infer bounding box dimensions using vehicle geometry priors.\n- **Level 3 (>50% Occluded)**: Heavily occluded; maintain track ID if trajectory is continuous.",
        citations: [
          {
            chunk_id: "demo-chunk-1",
            document_id: "demo-doc-1",
            document_title: "Perception & QC Annotation Guide",
            doc_type: "annotation_schema",
            version_number: 2,
            page: 24,
            section: "Occlusion Categories",
            content: "Occlusion levels are categorized into Level 1 (0-20%), Level 2 (20-50%), and Level 3 (>50%). Annotators must estimate total vehicle volume using standard length/width/height priors.",
            combined_score: 0.96,
            rerank_score: 0.985,
            rerank_rank: 1,
            original_rank: 1,
            rank_delta: 0,
            match_channel: "both",
            metadata: { page_number: 24, section: "Occlusion Categories" },
          },
        ],
        timestamp: "10:15 AM",
        model: "deepseek-chat",
        latencyMs: 340,
      },
    ],
  },
  {
    id: "session-cuboid",
    title: "Cuboid Alignment",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    dateCategory: "Today",
    messages: [],
  },
  {
    id: "session-tracking",
    title: "Tracking & Point Density",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    dateCategory: "Today",
    messages: [],
  },
];

export default function ChatPage() {
  const { user } = useAuth();

  // Sessions state
  const [sessions, setSessions] = useState<ConversationSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>("session-qc-rules");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Chat UI state
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [activeCitationModal, setActiveCitationModal] = useState<RetrievedChunkResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Hyperparameters
  const [candidateK, setCandidateK] = useState<number>(20);
  const [topK, setTopK] = useState<number>(5);
  const [minThreshold, setMinThreshold] = useState<number>(0.25);
  const [temperature, setTemperature] = useState<number>(0.2);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active session helper
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Load project list
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
  }, [messages, isStreaming]);

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
  };

  // Delete chat session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeSessionId && filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  // Send message
  const handleSendMessage = useCallback(
    async (queryText?: string) => {
      const query = (queryText || inputValue).trim();
      if (!query || isStreaming) return;

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `asst-${Date.now()}`;
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

      // Update session title if first message
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const updatedTitle = s.messages.length === 0 ? query.slice(0, 28) + (query.length > 28 ? "..." : "") : s.title;
            return {
              ...s,
              title: updatedTitle,
              messages: [...s.messages, newUserMessage, newAssistantMessage],
            };
          }
          return s;
        })
      );

      setInputValue("");
      setIsStreaming(true);

      const historyPayload: ChatMessage[] = messages.slice(-6).map((m) => ({
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
            },
            onError: (err) => {
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
                                m.content || `⚠️ Streaming error: ${err.message}`,
                            }
                          : m
                      ),
                    };
                  }
                  return s;
                })
              );
              setIsStreaming(false);
            },
          },
          abortControllerRef.current.signal
        );
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          console.error("Chat error:", err);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [inputValue, isStreaming, messages, activeSessionId, selectedProject, candidateK, topK, minThreshold, temperature]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col max-w-7xl mx-auto p-2 md:p-3 space-y-2">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold tracking-tight text-white">
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
            className={`h-7 px-2 text-xs gap-1 border-slate-800 ${showConfig ? "bg-sky-500/10 text-sky-400 border-sky-500/30" : ""}`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Optional Tuning Drawer */}
      {showConfig && (
        <Card className="border-slate-800 bg-slate-900/90 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs shadow-xl">
          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">Candidate Chunks (20)</label>
            <input
              type="number"
              value={candidateK}
              onChange={(e) => setCandidateK(Number(e.target.value))}
              min={5}
              max={50}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">Top Citations (5)</label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              min={1}
              max={10}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
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

      {/* ── 2-Column Split: Conversations on Left, AI Assistant on Right ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left Panel: Conversations (3 cols) */}
        <Card className="hidden md:flex md:col-span-3 flex-col border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden">
          <div className="p-3 border-b border-slate-800/80 space-y-2">
            <Button
              onClick={handleNewChat}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold py-2 rounded-lg shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              + New Chat
            </Button>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2">
                Today
              </span>
              <div className="mt-1 space-y-0.5">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition text-xs ${
                      session.id === activeSessionId
                        ? "bg-sky-500/15 border border-sky-500/30 text-white font-medium shadow-sm"
                        : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${session.id === activeSessionId ? "text-sky-400" : "text-slate-500"}`} />
                      <span className="truncate">{session.title}</span>
                    </div>

                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Right Panel: AI Assistant Main Canvas (9 cols) */}
        <Card className="md:col-span-9 flex flex-col border-slate-800 bg-slate-900/60 backdrop-blur overflow-hidden">
          {/* Top Assistant Status Bar */}
          <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
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
              {messages.length} messages
            </Badge>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  {DEFAULT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.query)}
                      className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/70 hover:bg-slate-800 hover:border-sky-500/40 text-left transition text-xs flex flex-col gap-1 group shadow-sm"
                    >
                      <span className="font-medium text-slate-200 group-hover:text-sky-400 transition flex items-center justify-between">
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
              messages.map((msg) => (
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
                    className={`rounded-2xl p-3.5 text-xs md:text-sm leading-relaxed max-w-[92%] md:max-w-[84%] shadow-sm ${
                      msg.role === "user"
                        ? "bg-sky-600 text-white rounded-tr-sm"
                        : "bg-slate-950 border border-slate-800/90 text-slate-100 rounded-tl-sm"
                    }`}
                  >
                    {/* DeepSeek-R1 Reasoning Accordion */}
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

                    {/* Message Body */}
                    {msg.content ? (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    ) : isStreaming && msg.role === "assistant" ? (
                      <div className="flex items-center gap-2 text-slate-400 py-1">
                        <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-400" />
                        <span>According to the guideline...</span>
                      </div>
                    ) : null}

                    {/* ── 📄 Sources Card (Directly attached under AI Message) ── */}
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-sky-400" />
                          📄 Sources
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, idx) => (
                            <button
                              key={c.chunk_id || idx}
                              onClick={() => setActiveCitationModal(c)}
                              className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-850 text-[11px] text-slate-300 transition flex items-center gap-1.5 group shadow-sm"
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

                  {/* Metadata Footer */}
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1 font-mono">
                      {msg.latencyMs && <span>{msg.latencyMs}ms</span>}
                      {msg.model && <span>{msg.model}</span>}
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="hover:text-slate-300 transition ml-1"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Bottom Input Bar ──────────────────────────────────────── */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 backdrop-blur">
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
                  className="h-10 px-4 gap-1.5 text-xs font-medium rounded-xl"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="h-10 px-4 gap-1.5 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </Button>
              )}
            </form>
          </div>
        </Card>
      </div>

      {/* ── Citation Detail Modal ───────────────────────────────────── */}
      {activeCitationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-xl border-slate-800 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                  <Bookmark className="w-4 h-4 text-sky-400" />
                  Source Citation Detail
                </CardTitle>
                <button
                  onClick={() => setActiveCitationModal(null)}
                  className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 rounded"
                >
                  ✕
                </button>
              </div>
              <CardDescription className="text-xs text-slate-400">
                {activeCitationModal.document_title} · Version {activeCitationModal.version_number}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                {activeCitationModal.page && (
                  <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-300">
                    Page {activeCitationModal.page}
                  </Badge>
                )}
                {activeCitationModal.section && (
                  <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-300">
                    {activeCitationModal.section}
                  </Badge>
                )}
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/60 text-emerald-300">
                  Relevance: {Math.round((activeCitationModal.rerank_score ?? activeCitationModal.combined_score) * 100)}%
                </Badge>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 font-sans leading-relaxed text-xs">
                {activeCitationModal.content}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveCitationModal(null)}
                  className="text-xs border-slate-800"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
