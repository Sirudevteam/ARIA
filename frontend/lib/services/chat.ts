import { RetrievedChunkResult } from "@/lib/services/search";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  name?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

export interface RAGChatRequest {
  query: string;
  project_id?: string;
  conversation_history?: ChatMessage[];
  stream?: boolean;
  candidate_k?: number;
  top_k?: number;
  min_relevance_threshold?: number;
  temperature?: number;
  max_tokens?: number;
}

export interface RAGChatResponse {
  query: string;
  answer: string;
  reasoning_content?: string;
  citations: RetrievedChunkResult[];
  model: string;
  usage?: TokenUsage;
  latency_ms: number;
}

export interface StreamEventHandlers {
  onCitations?: (citations: RetrievedChunkResult[]) => void;
  onDelta?: (delta: string, reasoningDelta?: string) => void;
  onDone?: (usage?: TokenUsage, finishReason?: string) => void;
  onError?: (error: Error) => void;
}

async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    // @ts-expect-error Clerk is on window
    if (window.Clerk?.session) {
      // @ts-expect-error Clerk getToken
      const token = await window.Clerk.session.getToken();
      if (token) return token;
    }
    return localStorage.getItem("aria_auth_token");
  } catch {
    return null;
  }
}

export const chatService = {
  /**
   * Non-streaming chat completion
   */
  async getChatCompletion(req: RAGChatRequest): Promise<RAGChatResponse> {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(`${BASE_URL}/api/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...req, stream: false }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Chat completion error (${res.status}): ${errText}`);
    }

    return res.json();
  },

  /**
   * Real-time Server-Sent Events (SSE) streaming chat completion
   */
  async streamChatCompletion(
    req: RAGChatRequest,
    handlers: StreamEventHandlers,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(`${BASE_URL}/api/v1/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...req, stream: true }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const errText = await res.text();
      const error = new Error(`Streaming failed (${res.status}): ${errText}`);
      handlers.onError?.(error);
      throw error;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const error = new Error("No readable stream received from server");
      handlers.onError?.(error);
      throw error;
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") {
            handlers.onDone?.();
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            if (data.type === "citations") {
              handlers.onCitations?.(data.citations || []);
            } else if (data.type === "delta") {
              handlers.onDelta?.(data.delta || "", data.reasoning_delta);
            } else if (data.type === "done") {
              handlers.onDone?.(data.usage, data.finish_reason);
            }
          } catch (parseErr) {
            console.warn("Failed to parse SSE line:", dataStr, parseErr);
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      handlers.onError?.(err as Error);
      throw err;
    }
  },

  /**
   * Submit thumbs up / down feedback
   */
  async submitFeedback(req: {
    query: string;
    response_content?: string;
    rating: "like" | "dislike";
    reason?: string;
    comment?: string;
    project_id?: string;
  }): Promise<{ id: string; status: string; message: string }> {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(`${BASE_URL}/api/v1/chat/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to submit feedback: ${errText}`);
    }

    return res.json();
  },
};
