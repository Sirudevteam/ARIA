export interface AdminOverviewKPIs {
  total_documents: number;
  total_users: number;
  total_projects: number;
  total_questions: number;
  total_feedback: number;
  total_failed_queries: number;
  positive_feedback_rate: number;
  avg_latency_ms: number;
}

export interface UnansweredQueryItem {
  id: string;
  query: string;
  project_name: string;
  timestamp: string;
  confidence_score: number;
  user_email: string;
  status: "pending" | "added_to_sop" | "dismissed";
}

export interface AIUsageStats {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  active_model: string;
  active_embedding_model: string;
  active_reranker_model: string;
}

export interface FeedbackAnalytics {
  total_feedback: number;
  positive_count: number;
  negative_count: number;
  satisfaction_rate: number;
  top_negative_reasons: { reason: string; count: number }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_email: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_name: string;
  ip_address: string;
  status: string;
}

export interface KnowledgeGapResolutionRequest {
  unanswered_id?: string;
  query: string;
  document_title: string;
  section_name: string;
  page_number?: number;
  new_guideline_content: string;
  project_id?: string;
}

export interface KnowledgeGapResolutionResponse {
  status: string;
  document_title: string;
  section_name: string;
  chunk_id: string;
  vector_dimension: number;
  embedding_model: string;
  message: string;
}
