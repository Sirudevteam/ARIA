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
  Layers,
  FileText,
  Bookmark,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  BrainCircuit,
  Compass,
  ArrowUpRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Square,
  Copy,
  Check,
  Eye,
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
  pipelineStep?: number; // 1 to 10
}

const PIPELINE_STEPS = [
  { id: 1, label: "Question", desc: "User prompt submitted" },
  { id: 2, label: "Authentication", desc: "Supabase JWT validated" },
  { id: 3, label: "Permission Filter", desc: "RBAC & project scope resolved" },
  { id: 4, label: "Query Processing", desc: "BGE-M3 1024d embedding generated" },
  { id: 5, label: "Hybrid Retrieval", desc: "pgvector + BM25 RRF fusion" },
  { id: 6, label: "Reranking", desc: "BGE-Reranker cross-encoder" },
  { id: 7, label: "Context Builder", desc: "XML grounded prompt composition" },
  { id: 8, label: "DeepSeek", desc: "DeepSeek-V3 / R1 reasoning" },
  { id: 9, label: "Citation Mapping", desc: "Metadata & page attribution" },
  { id: 10, label: "Streaming Answer", desc: "Server-Sent Events token stream" },
];

const PROMPT_SUGGESTIONS = [
  {
    title: "ISO 8855 Coordinate Standards",
    query: "What standard orientation do LiDAR coordinate axes use according to ISO 8855?",
  },
  {
    title: "Velodyne Calibration",
    query: "Explain the optical calibration and extrinsic rotation matrix setup for LiDAR sensors.",
  },
  {
    title: "3D Bounding Box Rules",
    query: "What are the occlusion categories and cuboid fitting guidelines for pedestrians and cyclists?",
  },
];

export default function ChatPage() {
  const { user } = useAuth();

  // State
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showConfig, setShowConfig] = useState(false);
  const [showPipelineHud, setShowPipelineHud] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [activeCitationModal, setActiveCitationModal] = useState<RetrievedChunkResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // RAG Hyperparameters
  const [candidateK, setCandidateK] = useState<number>(20);
  const [topK, setTopK] = useState<number>(5);
  const [minThreshold, setMinThreshold] = useState<number>(0.25);
  const [temperature, setTemperature] = useState<number>(0.2);
  const [streamEnabled, setStreamEnabled] = useState<boolean>(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load project list
  useEffect(() => {
    async function loadProjects() {
      const projs = await searchService.getProjects();
      setProjects(projs);
    }
    loadProjects();
  }, []);

  // Auto scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

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
      setCurrentStep(0);
    }
  };

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
        pipelineStep: 1,
      };

      setMessages((prev) => [...prev, newUserMessage, newAssistantMessage]);
      setInputValue("");
      setIsStreaming(true);
      setCurrentStep(1);

      // Build conversation history payload
      const historyPayload: ChatMessage[] = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      abortControllerRef.current = new AbortController();

      const startTime = performance.now();

      if (!streamEnabled) {
        // Non-streaming execution
        try {
          setCurrentStep(4);
          const res = await chatService.getChatCompletion({
            query,
            project_id: selectedProject || undefined,
            conversation_history: historyPayload,
            candidate_k: candidateK,
            top_k: topK,
            min_relevance_threshold: minThreshold,
            temperature,
          });

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: res.answer,
                    reasoningContent: res.reasoning_content,
                    citations: res.citations,
                    model: res.model,
                    usage: res.usage,
                    latencyMs: res.latency_ms,
                    pipelineStep: 10,
                  }
                : msg
            )
          );
          setCurrentStep(10);
        } catch (err: unknown) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: `⚠️ Failed to get answer: ${(err as Error).message}`,
                  }
                : msg
            )
          );
        } finally {
          setIsStreaming(false);
          setCurrentStep(0);
        }
        return;
      }

      // Streaming execution via SSE
      try {
        // Step progression simulation during retrieval
        setCurrentStep(2);
        const timer1 = setTimeout(() => setCurrentStep(4), 150);
        const timer2 = setTimeout(() => setCurrentStep(6), 350);

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
              clearTimeout(timer1);
              clearTimeout(timer2);
              setCurrentStep(8);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        citations,
                        pipelineStep: 8,
                      }
                    : msg
                )
              );
            },
            onDelta: (delta, reasoningDelta) => {
              setCurrentStep(10);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: msg.content + delta,
                        reasoningContent: reasoningDelta
                          ? (msg.reasoningContent || "") + reasoningDelta
                          : msg.reasoningContent,
                        pipelineStep: 10,
                      }
                    : msg
                )
              );
            },
            onDone: (usage) => {
              const latencyMs = Math.round(performance.now() - startTime);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        usage,
                        latencyMs,
                        model: "deepseek-chat",
                        pipelineStep: 10,
                      }
                    : msg
                )
              );
              setIsStreaming(false);
              setCurrentStep(0);
            },
            onError: (err) => {
              clearTimeout(timer1);
              clearTimeout(timer2);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content:
                          msg.content || `⚠️ Streaming error: ${err.message}`,
                      }
                    : msg
                )
              );
              setIsStreaming(false);
              setCurrentStep(0);
            },
          },
          abortControllerRef.current.signal
        );
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          console.error("Chat streaming error:", err);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [inputValue, isStreaming, messages, selectedProject, candidateK, topK, minThreshold, temperature, streamEnabled]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-2 md:p-4 max-w-7xl mx-auto">
      {/* Top Header & HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-primary/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/10">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                LiDAR Perception Assistant
              </h1>
              <Badge variant="outline" className="border-cyan-500/40 bg-cyan-950/40 text-cyan-300 text-[10px] py-0">
                10-Stage RAG Pipeline
              </Badge>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-[10px] py-0">
                DeepSeek-V3 / R1
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Enterprise ISO 8855 standards, optical calibration & 3D perception knowledge base
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Project selector */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="h-8 rounded-md bg-secondary/70 border border-border px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Authorized Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>

          {/* Pipeline HUD toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPipelineHud(!showPipelineHud)}
            className={`h-8 text-xs gap-1.5 border-border ${showPipelineHud ? "bg-primary/10 text-primary border-primary/30" : ""}`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">10-Step HUD</span>
          </Button>

          {/* Config Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="h-8 text-xs gap-1.5 border-border"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* 10-Step Pipeline Visualizer HUD */}
      {showPipelineHud && (
        <Card className="border-cyan-500/20 bg-cyan-950/10 backdrop-blur-sm shadow-sm py-2 px-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <span className="text-[11px] font-semibold tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
              10-Stage RAG Execution Flow
            </span>
            <span className="text-[10px] text-muted-foreground">
              {isStreaming ? `Step ${currentStep || 1}/10 in progress...` : "System Ready · Zero Hallucination Grounding"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-1.5 pt-2">
            {PIPELINE_STEPS.map((step) => {
              const isActive = isStreaming && currentStep === step.id;
              const isCompleted = isStreaming && currentStep > step.id;
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-md border text-center transition-all duration-200 ${
                    isActive
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20 animate-pulse"
                      : isCompleted
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-secondary/40 border-border/40 text-muted-foreground"
                  }`}
                  title={`${step.label}: ${step.desc}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono opacity-70">0{step.id}</span>
                    {isCompleted ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    ) : null}
                  </div>
                  <span className="text-[10px] font-medium truncate w-full">{step.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Collapsible Tuning Drawer */}
      {showConfig && (
        <Card className="border-border/60 bg-secondary/30 p-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-muted-foreground block mb-1">Candidate Chunks (k1)</label>
            <input
              type="number"
              value={candidateK}
              onChange={(e) => setCandidateK(Number(e.target.value))}
              min={5}
              max={50}
              className="w-full bg-background border border-border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-muted-foreground block mb-1">Top Citations (k2)</label>
            <input
              type="number"
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              min={1}
              max={10}
              className="w-full bg-background border border-border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-muted-foreground block mb-1">Min Relevance Filter</label>
            <input
              type="number"
              step="0.05"
              value={minThreshold}
              onChange={(e) => setMinThreshold(Number(e.target.value))}
              min={0}
              max={0.9}
              className="w-full bg-background border border-border rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="text-muted-foreground block mb-1">Temperature ({temperature})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={streamEnabled}
                onChange={(e) => setStreamEnabled(e.target.checked)}
                className="rounded border-border"
              />
              <span>SSE Real-time Stream</span>
            </label>
          </div>
        </Card>
      )}

      {/* Main Chat Conversation Container */}
      <Card className="flex-1 flex flex-col min-h-0 border-border/60 overflow-hidden bg-gradient-to-b from-background to-secondary/10">
        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-md">
                <Bot className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  LiDAR Perception Knowledge Base Ready
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ask technical questions grounded directly in ISO 8855 standards, camera-LiDAR sensor extrinsics, and point-cloud 3D annotation schemas.
                </p>
              </div>

              {/* Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-2xl pt-2">
                {PROMPT_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.query)}
                    className="p-2.5 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 text-left transition text-xs flex flex-col gap-1 group"
                  >
                    <span className="font-medium text-foreground group-hover:text-primary transition flex items-center justify-between">
                      {item.title}
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-2">
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
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`flex flex-col max-w-[88%] md:max-w-[78%] space-y-2 ${
                    msg.role === "user"
                      ? "items-end"
                      : "items-start"
                  }`}
                >
                  {/* Bubble */}
                  <div
                    className={`rounded-2xl p-3.5 text-xs md:text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary/60 border border-border/70 text-foreground rounded-tl-sm"
                    }`}
                  >
                    {/* DeepSeek Reasoning Trace Accordion */}
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
                            DeepSeek-R1 Reasoning Chain
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
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : isStreaming && msg.role === "assistant" ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-1">
                        <Sparkles className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Retrieving citations & generating grounded tokens...</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Assistant Citations & Metadata Bar */}
                  {msg.role === "assistant" && (
                    <div className="w-full space-y-2">
                      {/* Citations list */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="rounded-lg border border-border/50 bg-secondary/20 p-2 text-xs">
                          <button
                            onClick={() =>
                              setExpandedCitations((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="flex items-center justify-between w-full font-medium text-muted-foreground hover:text-foreground"
                          >
                            <span className="flex items-center gap-1.5 text-cyan-400">
                              <Bookmark className="w-3.5 h-3.5" />
                              {msg.citations.length} Verified Citations (BGE Reranked)
                            </span>
                            {expandedCitations[msg.id] ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {expandedCitations[msg.id] && (
                            <div className="mt-2 space-y-1.5 pt-1.5 border-t border-border/40">
                              {msg.citations.map((c, idx) => (
                                <div
                                  key={c.chunk_id || idx}
                                  className="p-2 rounded bg-background/60 border border-border/40 hover:border-primary/40 transition flex items-start justify-between gap-2"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] py-0 border-cyan-500/30 text-cyan-300">
                                        Citation [{idx + 1}]
                                      </Badge>
                                      <span className="font-medium text-foreground">{c.document_title}</span>
                                      {c.page && (
                                        <span className="text-[10px] text-muted-foreground">
                                          Page {c.page}
                                        </span>
                                      )}
                                      {c.section && (
                                        <span className="text-[10px] text-muted-foreground">
                                          · {c.section}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                                      {c.content}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0 gap-1">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {Math.round((c.rerank_score ?? c.combined_score) * 100)}% match
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setActiveCitationModal(c)}
                                      className="h-6 px-1.5 text-[10px] text-primary"
                                    >
                                      <Eye className="w-3 h-3 mr-1" /> View Chunk
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Performance & Token Metrics Footer */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {msg.latencyMs && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-emerald-400" />
                              {msg.latencyMs}ms
                            </span>
                          )}
                          {msg.usage && (
                            <span>
                              {msg.usage.total_tokens} tokens ({msg.usage.completion_tokens} gen)
                            </span>
                          )}
                          {msg.model && (
                            <Badge variant="outline" className="text-[9px] py-0">
                              {msg.model}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="p-1 hover:text-foreground transition rounded"
                            title="Copy answer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.role === "user" && (
                    <span className="text-[10px] text-muted-foreground mr-1">
                      {msg.timestamp}
                    </span>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-border/60 bg-background/80 backdrop-blur-sm">
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
              placeholder="Ask anything about LiDAR calibration, ISO 8855, perception schemas..."
              disabled={isStreaming}
              className="flex-1 bg-secondary/50 border border-border rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
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
                className="h-10 px-4 gap-1.5 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="w-3.5 h-3.5" />
                Ask ARIA
              </Button>
            )}
          </form>
        </div>
      </Card>

      {/* Citation Detail Modal */}
      {activeCitationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-xl border-border bg-card shadow-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-cyan-400" />
                  Citation Detail
                </CardTitle>
                <button
                  onClick={() => setActiveCitationModal(null)}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded"
                >
                  ✕
                </button>
              </div>
              <CardDescription className="text-xs">
                {activeCitationModal.document_title} · Version {activeCitationModal.version_number}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                {activeCitationModal.page && (
                  <Badge variant="secondary">Page {activeCitationModal.page}</Badge>
                )}
                {activeCitationModal.section && (
                  <Badge variant="outline">{activeCitationModal.section}</Badge>
                )}
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                  Relevance: {Math.round((activeCitationModal.rerank_score ?? activeCitationModal.combined_score) * 100)}%
                </Badge>
              </div>

              <div className="p-3 rounded-md bg-secondary/50 border border-border/50 text-foreground font-mono text-[12px] whitespace-pre-wrap leading-relaxed">
                {activeCitationModal.content}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveCitationModal(null)}
                  className="text-xs"
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
