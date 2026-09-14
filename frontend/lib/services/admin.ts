import { api } from "@/lib/api";
import {
  AdminConversationItem,
  AdminOverviewKPIs,
  AIUsageStats,
  AuditLogEntry,
  FeedbackAnalytics,
  KnowledgeGapResolutionRequest,
  KnowledgeGapResolutionResponse,
  UnansweredQueryItem,
} from "@/types/admin";

export const adminService = {
  async getOverviewKPIs(): Promise<AdminOverviewKPIs> {
    try {
      return await api.get<AdminOverviewKPIs>("/api/v1/admin/stats/overview");
    } catch {
      return {
        total_documents: 0,
        total_users: 0,
        total_projects: 0,
        total_questions: 0,
        total_feedback: 0,
        total_failed_queries: 0,
        positive_feedback_rate: 1.0,
        avg_latency_ms: 0,
      };
    }
  },

  async getUnansweredQuestions(statusFilter?: string): Promise<UnansweredQueryItem[]> {
    try {
      const url = statusFilter
        ? `/api/v1/admin/unanswered-questions?status_filter=${statusFilter}`
        : "/api/v1/admin/unanswered-questions";
      return await api.get<UnansweredQueryItem[]>(url);
    } catch {
      return [];
    }
  },

  async getAIUsageStats(): Promise<AIUsageStats> {
    try {
      return await api.get<AIUsageStats>("/api/v1/admin/ai-usage");
    } catch {
      return {
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
        active_model: "deepseek-chat",
        active_embedding_model: "BAAI/bge-m3",
        active_reranker_model: "BAAI/bge-reranker-v2-m3",
      };
    }
  },

  async getFeedbackAnalytics(): Promise<FeedbackAnalytics> {
    try {
      return await api.get<FeedbackAnalytics>("/api/v1/admin/feedback-analytics");
    } catch {
      return {
        total_feedback: 0,
        positive_count: 0,
        negative_count: 0,
        satisfaction_rate: 100,
        top_negative_reasons: [],
      };
    }
  },

  async getConversations(limit: number = 20): Promise<AdminConversationItem[]> {
    try {
      return await api.get<AdminConversationItem[]>(`/api/v1/admin/conversations?limit=${limit}`);
    } catch {
      return [];
    }
  },

  async getAuditLogs(limit: number = 20): Promise<AuditLogEntry[]> {
    try {
      return await api.get<AuditLogEntry[]>(`/api/v1/admin/audit-logs?limit=${limit}`);
    } catch {
      return [];
    }
  },

  async resolveKnowledgeGap(
    req: KnowledgeGapResolutionRequest
  ): Promise<KnowledgeGapResolutionResponse> {
    return await api.post<KnowledgeGapResolutionResponse>(
      "/api/v1/admin/knowledge-gaps/resolve",
      req
    );
  },
};
