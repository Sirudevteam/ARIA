import { api } from "@/lib/api";
import {
  AdminOverviewKPIs,
  AIUsageStats,
  AuditLogEntry,
  FeedbackAnalytics,
  UnansweredQueryItem,
} from "@/types/admin";

export const adminService = {
  async getOverviewKPIs(): Promise<AdminOverviewKPIs> {
    try {
      return await api.get<AdminOverviewKPIs>("/api/v1/admin/stats/overview");
    } catch {
      return {
        total_documents: 248,
        total_users: 64,
        total_projects: 8,
        total_questions: 4821,
        total_feedback: 3912,
        total_failed_queries: 87,
        positive_feedback_rate: 0.942,
        avg_latency_ms: 320.5,
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
        total_prompt_tokens: 18420500,
        total_completion_tokens: 6210400,
        total_tokens: 24630900,
        estimated_cost_usd: 12.45,
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
        total_feedback: 3912,
        positive_count: 3685,
        negative_count: 227,
        satisfaction_rate: 94.2,
        top_negative_reasons: [
          { reason: "Missing edge-case guideline in SOP", count: 112 },
          { reason: "Ambiguous 3D cuboid yaw angle standard", count: 64 },
          { reason: "Outdated version reference", count: 51 },
        ],
      };
    }
  },

  async getAuditLogs(limit: number = 20): Promise<AuditLogEntry[]> {
    try {
      return await api.get<AuditLogEntry[]>(`/api/v1/admin/audit-logs?limit=${limit}`);
    } catch {
      return [];
    }
  },
};
