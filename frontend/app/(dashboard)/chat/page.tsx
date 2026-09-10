"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { chatService, ChatMessage, TokenUsage } from "@/lib/services/chat";
import { ProjectSummary } from "@/types/document";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { CitationModal } from "@/components/chat/CitationModal";
import {
  Send,
  Sparkles,
  Bot,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
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
    title: "Partially Occluded Vehicles",
    query: "What is the correct rule for partially occluded vehicles?",
  },
  {
    title: "3D Cuboid Placement",
    query: "How should a 3D cuboid be placed?",
  },
  {
    title: "Common Annotation Errors",
    query: "What are the common annotation errors?",
  },
  {
    title: "QC Procedure",
    query: "What is the QC procedure for an annotation?",
  },
];

const STORAGE_KEY = "aria_chat_sessions_v2";
const EMPTY_MESSAGES: MessageItem[] = [];

export default function ChatPage() {
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
  const [streamingStatusText, setStreamingStatusText] = useState("Searching annotation knowledge...");
  const [showConfig, setShowConfig] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [activeCitationModal, setActiveCitationModal] = useState<{ citation: RetrievedChunkResult; index: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Auto-dismiss error banner
  useEffect(() => {
    if (errorBanner) {
      const timer = setTimeout(() => setErrorBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorBanner]);

  // Closed-loop Feedback Modal State
  const [feedbackModalMsg, setFeedbackModalMsg] = useState<MessageItem | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<string>("Missing guideline in SOP");
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [feedbackSubmittedMsgId, setFeedbackSubmittedMsgId] = useState<string | null>(null);

  // Hyperparameters
  const [candidateK, setCandidateK] = useState<number>(20);
  const [topK, setTopK] = useState<number>(5);
  const [minThreshold, setMinThreshold] = useState<number>(0.15);
  const [temperature, setTemperature] = useState<number>(0.2);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions from localStorage
  useEffect(() => {
    let isMounted = true;

    async function loadStoredSessions() {
      await Promise.resolve();

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (!isMounted) return;
            setSessions(parsed);
            setActiveSessionId(parsed[0].id);
            setIsLoaded(true);
            return;
          }
        }
      } catch {
        // Fallback
      }

      if (!isMounted) return;

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
    }

    loadStoredSessions();

    return () => {
      isMounted = false;
    };
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
  const messages = activeSession?.messages || EMPTY_MESSAGES;

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
  const handleFeedback = async (messageId: string, feedbackType: "like" | "dislike") => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    if (feedbackType === "dislike") {
      // Open closed-loop gap reason modal for admin review
      setFeedbackModalMsg(targetMsg);
      return;
    }

    // Like rating
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id === messageId) {
                return {
                  ...m,
                  feedback: m.feedback === "like" ? null : "like",
                };
              }
              return m;
            }),
          };
        }
        return s;
      })
    );

    try {
      await chatService.submitFeedback({
        query: messages[messages.indexOf(targetMsg) - 1]?.content || "User Query",
        response_content: targetMsg.content,
        rating: "like",
        project_id: selectedProject || undefined,
      });
    } catch (e) {
      console.warn("Feedback logging warning:", e);
    }
  };

  const handleSubmitNegativeFeedback = async () => {
    if (!feedbackModalMsg) return;
    const msgIndex = messages.indexOf(feedbackModalMsg);
    const userQuery = msgIndex > 0 ? messages[msgIndex - 1]?.content : "User Query";

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.map((m) =>
              m.id === feedbackModalMsg.id ? { ...m, feedback: "dislike" } : m
            ),
          };
        }
        return s;
      })
    );

    try {
      await chatService.submitFeedback({
        query: userQuery,
        response_content: feedbackModalMsg.content,
        rating: "dislike",
        reason: feedbackReason,
        comment: feedbackComment || undefined,
        project_id: selectedProject || undefined,
      });
      setFeedbackSubmittedMsgId(feedbackModalMsg.id);
      setTimeout(() => setFeedbackSubmittedMsgId(null), 4000);
    } catch (e) {
      console.warn("Feedback submit warning:", e);
    } finally {
      setFeedbackModalMsg(null);
      setFeedbackComment("");
    }
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
      setStreamingStatusText("Searching annotation knowledge...");

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
              setStreamingStatusText("Generating grounded answer...");
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
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === activeSessionId) {
                    const existingMsg = s.messages.find((m) => m.id === assistantMsgId);
                    if (existingMsg && existingMsg.content.trim().length > 0) {
                      return s;
                    }
                    setErrorBanner(err.message);
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
          // Only show error if no response was produced
          setSessions((prev) => {
            const currentSession = prev.find((s) => s.id === activeSessionId);
            const currentMsg = currentSession?.messages.find((m) => m.id === assistantMsgId);
            if (!currentMsg || currentMsg.content.trim().length === 0) {
              setErrorBanner((err as Error).message);
            }
            return prev;
          });
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
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* â”€â”€ Left Conversation Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={`${
          mobileSidebarOpen ? "flex absolute inset-y-0 left-0 z-30" : "hidden"
        } md:flex flex-col w-56 shrink-0`}
        style={{
          background: "#050d1a",
          borderRight: "1px solid rgba(14,165,233,0.1)",
        }}
      >
        {/* New chat */}
        <div className="p-3 border-b border-slate-800/40">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-white transition-all"
            style={{
              background: "rgba(14,165,233,0.12)",
              border: "1px solid rgba(14,165,233,0.25)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(14,165,233,0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(14,165,233,0.12)")
            }
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            New Conversation
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {todaySessions.length > 0 && (
            <div className="mb-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-700 px-2">
                Today
              </span>
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between px-2.5 py-2 mt-1 rounded-lg cursor-pointer transition-all text-xs ${
                    session.id === activeSessionId
                      ? "text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                  }`}
                  style={
                    session.id === activeSessionId
                      ? {
                          background: "rgba(14,165,233,0.08)",
                          border: "1px solid rgba(14,165,233,0.18)",
                        }
                      : { border: "1px solid transparent" }
                  }
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        session.id === activeSessionId ? "text-sky-400" : "text-slate-600"
                      }`}
                    />
                    <span className="truncate">{session.title}</span>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {previousSessions.length > 0 && (
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-700 px-2">
                Previous
              </span>
              {previousSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between px-2.5 py-2 mt-1 rounded-lg cursor-pointer transition-all text-xs ${
                    session.id === activeSessionId
                      ? "text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                  }`}
                  style={
                    session.id === activeSessionId
                      ? {
                          background: "rgba(14,165,233,0.08)",
                          border: "1px solid rgba(14,165,233,0.18)",
                        }
                      : { border: "1px solid transparent" }
                  }
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        session.id === activeSessionId ? "text-sky-400" : "text-slate-600"
                      }`}
                    />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-slate-800/40">
          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono">
            <Clock className="w-3 h-3" />
            <span>{messages.length} messages</span>
          </div>
        </div>
      </div>

      {/* â”€â”€ Main Chat Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Background dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #0ea5e9 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* â”€â”€ Top bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="relative z-10 flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid rgba(14,165,233,0.1)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: "rgba(14,165,233,0.1)",
                border: "1px solid rgba(14,165,233,0.25)",
              }}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-wide">
                ARIA Â· AI ASSISTANT
              </h1>
              <p className="text-[10px] text-slate-600 font-mono">
                DeepSeek-V3 Â· BGE-M3 Â· pgvector RAG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Project selector */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-7 rounded-md px-2 text-xs text-slate-300 outline-none"
              style={{
                background: "#040c19",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Settings toggle */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`h-7 px-2.5 rounded-md text-xs flex items-center gap-1.5 transition-all ${
                showConfig ? "text-sky-300" : "text-slate-500 hover:text-slate-300"
              }`}
              style={{
                background: showConfig ? "rgba(14,165,233,0.08)" : "transparent",
                border: `1px solid ${showConfig ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>

        {/* RAG Settings panel */}
        {showConfig && (
          <div
            className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(4,12,25,0.9)" }}
          >
            {[
              { label: "Candidate Chunks (k1)", value: candidateK, min: 5, max: 50, type: "number", onChange: (v: number) => setCandidateK(v) },
              { label: "Top Citations (k2)", value: topK, min: 1, max: 10, type: "number", onChange: (v: number) => setTopK(v) },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[10px] text-slate-600 block mb-1">{f.label}</label>
                <input
                  type="number"
                  value={f.value}
                  onChange={(e) => f.onChange(Number(e.target.value))}
                  min={f.min}
                  max={f.max}
                  className="w-full px-2 py-1 rounded text-xs text-slate-200 font-mono outline-none"
                  style={{ background: "#040c19", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] text-slate-600 block mb-1">
                Min Relevance ({Math.round(minThreshold * 100)}%)
              </label>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={minThreshold}
                onChange={(e) => setMinThreshold(Number(e.target.value))}
                className="w-full h-1.5 rounded accent-sky-500"
                style={{ background: "#040c19" }}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-600 block mb-1">
                Temperature ({temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-1.5 rounded accent-sky-500"
                style={{ background: "#040c19" }}
              />
            </div>
          </div>
        )}

        {/* Error banner */}
        {errorBanner && (
          <div
            className="relative z-10 flex items-center justify-between px-4 py-2 text-xs"
            style={{
              background: "rgba(239,68,68,0.07)",
              borderBottom: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-red-500 hover:text-red-300 font-bold px-1"
            >
              âœ•
            </button>
          </div>
        )}

        {/* â”€â”€ Messages area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center text-center space-y-5 max-w-lg mx-auto">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(14,165,233,0.08)",
                  border: "1px solid rgba(14,165,233,0.2)",
                }}
              >
                <Bot className="w-7 h-7 text-sky-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  How can ARIA help?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask questions about annotation guidelines, object classes, occlusion, QC and validation.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {DEFAULT_PROMPT_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.query)}
                    className="group p-3.5 rounded-xl text-left transition-all flex flex-col gap-1.5 cursor-pointer"
                    style={{
                      background: "rgba(14,165,233,0.04)",
                      border: "1px solid rgba(14,165,233,0.14)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "rgba(14,165,233,0.4)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "rgba(14,165,233,0.14)")
                    }
                  >
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 transition flex items-center justify-between">
                      {item.title}
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:text-sky-300" />
                    </span>
                    <span className="text-[11px] text-slate-500 line-clamp-2 text-left">
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
                className={`flex flex-col space-y-1.5 ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Role label */}
                <span className="text-[10px] font-semibold text-slate-600 px-1 font-mono">
                  {msg.role === "user" ? "YOU" : "ARIA"}
                </span>

                {/* Bubble */}
                <div
                  className={`rounded-xl text-xs md:text-sm leading-relaxed max-w-[92%] md:max-w-[80%] ${
                    msg.role === "user"
                      ? "px-4 py-3 text-white rounded-tr-sm"
                      : "px-4 py-3.5 text-slate-100 rounded-tl-sm"
                  }`}
                  style={
                    msg.role === "user"
                      ? {
                          background: "rgba(14,165,233,0.9)",
                          boxShadow: "0 2px 12px rgba(14,165,233,0.2)",
                        }
                      : {
                          background: "rgba(8,15,30,0.95)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }
                  }
                >
                  {/* DeepSeek Reasoning accordion */}
                  {msg.reasoningContent && (
                    <div
                      className="mb-3 rounded-lg p-2.5 text-xs"
                      style={{
                        background: "rgba(139,92,246,0.08)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedReasoning((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        className="flex items-center justify-between w-full text-purple-300 hover:text-purple-200"
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                          DeepSeek Reasoning
                        </span>
                        {expandedReasoning[msg.id] ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {expandedReasoning[msg.id] && (
                        <div className="mt-2 pt-2 border-t border-purple-500/20 text-purple-200/80 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                          {msg.reasoningContent}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  {msg.content ? (
                    <MarkdownRenderer
                      content={msg.content}
                      onCitationClick={(citNum) =>
                        handleCitationClick(citNum, msg.citations)
                      }
                    />
                  ) : isStreaming && msg.role === "assistant" ? (
                    <div className="flex items-center gap-2 text-slate-500 py-1">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      <span className="text-xs font-mono aria-scan-pulse">
                        {streamingStatusText}
                      </span>
                    </div>
                  ) : null}

                  {/* Sources (Deduplicated & Clean Minimalist Grouping) */}
                  {msg.role === "assistant" &&
                    msg.citations &&
                    msg.citations.length > 0 && (() => {
                      const docGroups: {
                        title: string;
                        docType?: string;
                        pages: number[];
                        items: { citation: any; index: number }[];
                      }[] = [];

                      msg.citations.forEach((c, idx) => {
                        const title = c.document_title || "Reference Document";
                        let group = docGroups.find((g) => g.title === title);
                        if (!group) {
                          group = {
                            title,
                            docType: c.doc_type,
                            pages: [],
                            items: [],
                          };
                          docGroups.push(group);
                        }
                        if (c.page != null && !group.pages.includes(c.page)) {
                          group.pages.push(c.page);
                        }
                        group.items.push({ citation: c, index: idx + 1 });
                      });

                      return (
                        <div
                          className="mt-3.5 pt-3 space-y-2"
                          style={{ borderTop: "1px solid rgba(14,165,233,0.12)" }}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                            <FileText className="w-3.5 h-3.5 text-sky-400" />
                            <span>
                              {docGroups.length === 1
                                ? `Source Document (${msg.citations.length} Verified Chunks)`
                                : `Sources (${docGroups.length} Documents · ${msg.citations.length} Verified Chunks)`}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {docGroups.map((group) => (
                              <div
                                key={group.title}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                                style={{
                                  background: "rgba(14,165,233,0.06)",
                                  border: "1px solid rgba(14,165,233,0.2)",
                                }}
                              >
                                <span className="text-sm">📄</span>
                                <span className="font-semibold text-white truncate max-w-[240px]" title={group.title}>
                                  {group.title}
                                </span>
                                {group.pages.length > 0 && (
                                  <span className="text-[10px] text-sky-300 font-mono bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-500/25">
                                    {group.pages.length === 1
                                      ? `Page ${group.pages[0]}`
                                      : `Pages ${group.pages.sort((a: number, b: number) => a - b).join(", ")}`}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 border-l border-sky-500/20 pl-1.5 ml-0.5">
                                  {group.items.map((item) => (
                                    <button
                                      key={item.index}
                                      onClick={() =>
                                        setActiveCitationModal({
                                          citation: item.citation,
                                          index: item.index,
                                        })
                                      }
                                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-sky-300 bg-sky-500/15 hover:bg-sky-400 hover:text-slate-950 border border-sky-500/30 transition cursor-pointer"
                                      title={`View citation [${item.index}] text excerpt`}
                                    >
                                      [{item.index}]
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* Message meta toolbar (assistant) */}
                {msg.role === "assistant" && msg.content && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-700 px-1 font-mono">
                    {msg.latencyMs && <span>{msg.latencyMs}ms</span>}
                    {msg.model && <span className="text-slate-800">Â·</span>}
                    {msg.model && <span>{msg.model}</span>}

                    <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2 ml-1">
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="p-1 hover:text-slate-400 transition rounded"
                        title="Copy"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRegenerate(mIdx)}
                        className="p-1 hover:text-slate-400 transition rounded"
                        title="Regenerate"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, "like")}
                        className={`p-1 transition rounded ${
                          msg.feedback === "like" ? "text-emerald-400" : "hover:text-slate-400"
                        }`}
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, "dislike")}
                        className={`p-1 transition rounded ${
                          msg.feedback === "dislike" ? "text-red-400" : "hover:text-slate-400"
                        }`}
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {msg.role === "user" && (
                  <span className="text-[10px] text-slate-700 mr-1 font-mono">
                    {msg.timestamp}
                  </span>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* â”€â”€ Input bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="relative z-10 px-4 py-3"
          style={{ borderTop: "1px solid rgba(14,165,233,0.1)", background: "rgba(5,13,26,0.9)" }}
        >
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
              placeholder="Ask about occlusion thresholds, cuboid fitting rules, calibration specs..."
              disabled={isStreaming}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:ring-1 focus:ring-sky-500"
              style={{
                background: "#040c19",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="h-10 px-4 rounded-xl text-xs font-medium text-white flex items-center gap-1.5 transition"
                style={{
                  background: "rgba(239,68,68,0.7)",
                  border: "1px solid rgba(239,68,68,0.4)",
                }}
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="h-10 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
                style={{
                  background: inputValue.trim()
                    ? "rgba(14,165,233,1)"
                    : "rgba(14,165,233,0.25)",
                  boxShadow: inputValue.trim()
                    ? "0 0 20px rgba(14,165,233,0.25)"
                    : "none",
                  cursor: inputValue.trim() ? "pointer" : "not-allowed",
                }}
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            )}
          </form>
        </div>
      </div>

      {/* â”€â”€ Citation Source Viewer Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {activeCitationModal && (
        <CitationModal
          citation={activeCitationModal.citation}
          citationIndex={activeCitationModal.index}
          onClose={() => setActiveCitationModal(null)}
        />
      )}

      {/* â”€â”€ Negative Feedback Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {feedbackModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-xl overflow-hidden"
            style={{
              background: "#050d1a",
              border: "1px solid rgba(239,68,68,0.2)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.7)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="flex items-center gap-2">
                <ThumbsDown className="w-4 h-4 text-red-400" />
                <span className="text-sm font-bold text-white">Flag for SOP Review</span>
              </div>
              <button
                onClick={() => setFeedbackModalMsg(null)}
                className="text-slate-500 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-400">
                Your feedback flags this query for the Admin team to update guidelines
                and re-index the knowledge base.
              </p>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">
                  What was the primary issue?
                </label>
                <select
                  value={feedbackReason}
                  onChange={(e) => setFeedbackReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{ background: "#040c19", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <option value="Missing guideline in SOP">Missing guideline or edge-case in SOP</option>
                  <option value="Ambiguous 3D cuboid standard">Ambiguous 3D bounding box / yaw angle standard</option>
                  <option value="Outdated document version">Outdated document version referenced</option>
                  <option value="Inaccurate / hallucinated answer">Inaccurate / hallucinated answer</option>
                  <option value="Other">Other annotation question issue</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">
                  Additional detail (optional):
                </label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="e.g. Need clarification on minimum point count for heavy trailers..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-slate-700 outline-none resize-none"
                  style={{ background: "#040c19", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>

              <div
                className="flex items-center justify-end gap-2 pt-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
              >
                <button
                  onClick={() => setFeedbackModalMsg(null)}
                  className="h-8 px-4 rounded-lg text-xs text-slate-400 hover:text-white transition"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitNegativeFeedback}
                  className="h-8 px-4 rounded-lg text-xs font-semibold text-white transition"
                  style={{ background: "rgba(239,68,68,0.8)", boxShadow: "0 0 16px rgba(239,68,68,0.2)" }}
                >
                  Submit for SOP Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback confirmation toast */}
      {feedbackSubmittedMsgId && (
        <div
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-emerald-300"
          style={{
            background: "rgba(4,48,32,0.95)",
            border: "1px solid rgba(52,211,153,0.3)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <Check className="w-4 h-4 text-emerald-400" />
          Feedback submitted Â· Queued for SOP review
        </div>
      )}
    </div>
  );
}
