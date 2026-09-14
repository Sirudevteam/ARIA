"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { searchService, RetrievedChunkResult } from "@/lib/services/search";
import { chatService, ChatMessage, TokenUsage } from "@/lib/services/chat";
import { useAuth } from "@/components/providers/auth-provider";
import { ProjectSummary } from "@/types/document";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { CitationModal, CitationData } from "@/components/chat/CitationModal";
import { ConversationSidebar, ConversationSession } from "@/components/chat/ConversationSidebar";
import { ChatInput } from "@/components/chat/ChatInput";
import { RAGSettingsPanel } from "@/components/chat/RAGSettingsPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FadeIn, SlideUp } from "@/components/ui/motion";
import {
  Sparkles,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Menu,
  X,
  FileText,
  Clock,
  Layers,
  HelpCircle,
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

const DEFAULT_PROMPT_SUGGESTIONS = [
  {
    title: "Partially Occluded Vehicles",
    query: "What is the correct rule for partially occluded vehicles?",
    icon: Layers,
  },
  {
    title: "3D Cuboid Placement",
    query: "How should a 3D cuboid be placed?",
    icon: Sparkles,
  },
  {
    title: "Common Annotation Errors",
    query: "What are the common annotation errors in LiDAR labeling?",
    icon: AlertCircle,
  },
  {
    title: "QC Procedure",
    query: "What is the QC procedure for verified point cloud annotations?",
    icon: HelpCircle,
  },
];

const STORAGE_KEY = "aria_chat_sessions_v2";

export default function ChatPage() {
  const { user } = useAuth();

  // Sessions state
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
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
  const [activeCitation, setActiveCitation] = useState<CitationData | null>(null);
  const [isCitationOpen, setIsCitationOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Hyperparameters
  const [candidateK, setCandidateK] = useState<number>(20);
  const [topK, setTopK] = useState<number>(5);
  const [minThreshold, setMinThreshold] = useState<number>(0.15);
  const [temperature, setTemperature] = useState<number>(0.2);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ConversationSession[] = JSON.parse(raw);
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      }
    } catch (e) {
      console.warn("Failed to load chat sessions", e);
    }
    setIsLoaded(true);
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Failed to save chat sessions", e);
    }
  }, [sessions, isLoaded]);

  // Load projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const projs = await searchService.getProjects();
        setProjects(projs);
      } catch (e) {
        console.warn("Failed to load projects", e);
      }
    }
    loadProjects();
  }, []);

  // Current active session
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages: MessageItem[] = activeSession?.messages || [];

  useEffect(() => {
    scrollToBottom(false);
  }, [activeSessionId, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  // Create new chat
  const handleNewChat = () => {
    const newSession: ConversationSession = {
      id: `session_${Date.now()}`,
      title: "New Conversation",
      createdAt: new Date().toISOString(),
      dateCategory: "Today",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputValue("");
    setMobileSidebarOpen(false);
  };

  // Delete chat
  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (activeSessionId === id && updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else if (updated.length === 0) {
        setActiveSessionId("");
      }
      return updated;
    });
  };

  // Copy message
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Feedback
  const handleFeedback = async (messageId: string, type: "like" | "dislike") => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            return { ...m, feedback: type };
          }),
        };
      })
    );

    try {
      const targetMsg = messages.find((m) => m.id === messageId);
      const lastUserQuery = [...messages].reverse().find((m) => m.role === "user")?.content || "LiDAR query";
      await chatService.submitFeedback({
        query: lastUserQuery,
        response_content: targetMsg?.content,
        rating: type,
        project_id: selectedProject || undefined,
      });
    } catch (e) {
      console.warn("Feedback submission error", e);
    }
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isStreaming) return;

    let targetSessionId = activeSessionId;

    // Create session if none active
    if (!targetSessionId || !activeSession) {
      const newSession: ConversationSession = {
        id: `session_${Date.now()}`,
        title: query.slice(0, 36) + (query.length > 36 ? "..." : ""),
        createdAt: new Date().toISOString(),
        dateCategory: "Today",
        messages: [],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      targetSessionId = newSession.id;
    }

    const userMessage: MessageItem = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantPlaceholderId = `msg_ast_${Date.now()}`;
    const assistantPlaceholder: MessageItem = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Update session title if first message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== targetSessionId) return s;
        const isFirst = s.messages.length === 0;
        return {
          ...s,
          title: isFirst ? query.slice(0, 36) + (query.length > 36 ? "..." : "") : s.title,
          messages: [...s.messages, userMessage, assistantPlaceholder],
        };
      })
    );

    setInputValue("");
    setIsStreaming(true);
    setStreamingStatusText("Searching annotation knowledge...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const historyPayload: ChatMessage[] = [
        ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: query },
      ];

      let streamedText = "";
      let retrievedCitations: RetrievedChunkResult[] = [];
      let startTime = Date.now();

      await chatService.streamChatCompletion(
        {
          query: query,
          conversation_history: historyPayload,
          project_id: selectedProject || undefined,
          candidate_k: candidateK,
          top_k: topK,
          min_relevance_threshold: minThreshold,
          temperature: temperature,
        },
        {
          onCitations: (citations) => {
            retrievedCitations = citations;
          },
          onDelta: (delta) => {
            streamedText += delta;
            setSessions((prev) =>
              prev.map((s) => {
                if (s.id !== targetSessionId) return s;
                return {
                  ...s,
                  messages: s.messages.map((m) => {
                    if (m.id !== assistantPlaceholderId) return m;
                    return { ...m, content: streamedText };
                  }),
                };
              })
            );
          },
          onError: (err) => {
            console.error("Stream completion error", err);
          },
        },
        controller.signal
      );

      // Final update with latency and citations
      const latency = Date.now() - startTime;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id !== assistantPlaceholderId) return m;
              return {
                ...m,
                content: streamedText,
                citations: retrievedCitations,
                latencyMs: latency,
              };
            }),
          };
        })
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setErrorBanner(err.message || "Failed to generate AI response. Please retry.");
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== targetSessionId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id !== assistantPlaceholderId) return m;
                return {
                  ...m,
                  content: "Sorry, an error occurred while connecting to the RAG knowledge service.",
                  isError: true,
                };
              }),
            };
          })
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  // Open citation modal
  const handleOpenCitation = (chunk: RetrievedChunkResult, index: number) => {
    const score = Math.round((chunk.rerank_score ?? chunk.combined_score ?? 0) * 100);
    setActiveCitation({
      title: chunk.document_title || "LiDAR Guideline Document",
      page: chunk.page,
      version: chunk.version_number ? `v${chunk.version_number}` : undefined,
      relevance: score,
      excerpt: chunk.content,
    });
    setIsCitationOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh-5.5rem)] sm:h-[calc(100vh-6.5rem)] rounded-2xl overflow-hidden glass-panel border border-white/[0.08] shadow-2xl relative">
      {/* Desktop conversation sidebar */}
      <ConversationSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => setActiveSessionId(id)}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        className="hidden md:flex w-72 shrink-0"
      />

      {/* Mobile conversation sidebar Sheet */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-80 bg-[#0a0f1a] border-r border-white/[0.06]">
          <ConversationSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              setMobileSidebarOpen(false);
            }}
            onNewChat={() => {
              handleNewChat();
              setMobileSidebarOpen(false);
            }}
            onDeleteSession={handleDeleteSession}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            className="w-full h-full"
          />
        </SheetContent>
      </Sheet>

      {/* Main chat canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f1a]/60 relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-slate-950/40 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                ARIA ASSISTANT
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {activeSession?.title || "New Conversation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="hidden sm:inline">DeepSeek-V3 · BGE-M3</span>
          </div>
        </div>

        {/* Hyperparameters panel */}
        {showConfig && (
          <div className="border-b border-white/[0.06] bg-slate-950/90 backdrop-blur-xl z-20">
            <RAGSettingsPanel
              candidateK={candidateK}
              onCandidateKChange={setCandidateK}
              topK={topK}
              onTopKChange={setTopK}
              minThreshold={minThreshold}
              onMinThresholdChange={setMinThreshold}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              onResetDefaults={() => {
                setCandidateK(20);
                setTopK(5);
                setMinThreshold(0.15);
                setTemperature(0.2);
              }}
            />
          </div>
        )}

        {/* Error banner */}
        {errorBanner && (
          <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {messages.length === 0 ? (
            /* Empty state with prompt suggestions */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
                <Sparkles className="w-7 h-7 text-sky-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">How can ARIA assist you?</h3>
              <p className="text-xs text-slate-400 mb-8 max-w-md">
                Ask any question regarding 3D point cloud guidelines, cuboid placement standards, occlusion rules, and validation specs.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {DEFAULT_PROMPT_SUGGESTIONS.map((sug, i) => {
                  const Icon = sug.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sug.query)}
                      className="p-3.5 rounded-xl text-left glass-card border border-white/[0.06] hover:border-sky-400/30 hover:bg-sky-500/5 transition-all group flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:border-sky-400/40">
                        <Icon className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block group-hover:text-sky-300 transition-colors">
                          {sug.title}
                        </span>
                        <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {sug.query}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Messages list */
            messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                      <Bot className="w-4 h-4 text-sky-400" />
                    </div>
                  )}

                  <div className={`max-w-[92%] sm:max-w-[85%] md:max-w-[75%] space-y-2`}>
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-tr-none shadow-lg"
                          : "glass-card border border-white/[0.08] text-slate-200 rounded-tl-none"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div>
                          <MarkdownRenderer
                            content={msg.content}
                            onCitationClick={(num) => {
                              if (msg.citations && msg.citations[num - 1]) {
                                handleOpenCitation(msg.citations[num - 1], num);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Citations chips */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-mono text-slate-500 mr-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Sources:
                        </span>
                        {msg.citations.map((cite, cIdx) => {
                          const score = Math.round((cite.rerank_score ?? cite.combined_score ?? 0) * 100);
                          return (
                            <button
                              key={cIdx}
                              onClick={() => handleOpenCitation(cite, cIdx + 1)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-sky-500/10 border border-sky-400/20 text-sky-300 hover:bg-sky-500/20 transition-all flex items-center gap-1"
                            >
                              <span>[{cIdx + 1}]</span>
                              <span className="truncate max-w-[120px]">
                                {cite.document_title || "Document"}
                              </span>
                              <span className="text-[9px] opacity-60 font-sans">({score}%)</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Message metadata & actions */}
                    {!isUser && (
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                        {msg.latencyMs && (
                          <span className="font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {Math.round(msg.latencyMs)}ms
                          </span>
                        )}

                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleFeedback(msg.id, "like")}
                            className={`p-1 transition-colors ${
                              msg.feedback === "like"
                                ? "text-emerald-400"
                                : "text-slate-500 hover:text-emerald-400"
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleFeedback(msg.id, "dislike")}
                            className={`p-1 transition-colors ${
                              msg.feedback === "dislike"
                                ? "text-red-400"
                                : "text-slate-500 hover:text-red-400"
                            }`}
                            title="Not helpful"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <ChatInput
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={() => handleSendMessage()}
          onStop={handleStopGeneration}
          isStreaming={isStreaming}
          streamingStatusText={streamingStatusText}
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
          projects={projects}
          onToggleSettings={() => setShowConfig(!showConfig)}
          showSettings={showConfig}
        />
      </div>

      {/* Citation inspection modal */}
      <CitationModal
        isOpen={isCitationOpen}
        onClose={() => setIsCitationOpen(false)}
        citation={activeCitation}
      />
    </div>
  );
}
