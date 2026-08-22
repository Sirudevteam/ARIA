import { api } from "@/lib/api";
import { ProjectSummary } from "@/types/document";

export interface RetrievedChunkResult {
  chunk_id: string;
  document_id: string;
  document_title: string;
  doc_type: string;
  version_number: number;
  page?: number;
  section?: string;
  content: string;
  similarity_score?: number;
  keyword_score?: number;
  combined_score: number;
  dense_rank?: number;
  keyword_rank?: number;
  rerank_score?: number;
  rerank_rank?: number;
  original_rank?: number;
  rank_delta?: number;
  match_channel: "both" | "vector_only" | "keyword_only" | string;
  reranker_model?: string;
  metadata: Record<string, unknown>;
}

export interface RetrievalSearchResponse {
  query: string;
  total_results: number;
  top_k: number;
  alpha: number;
  fusion_mode: string;
  reranker_enabled: boolean;
  reranker_model?: string;
  results: RetrievedChunkResult[];
}

export interface SearchQueryParams {
  query: string;
  project_id?: string;
  department_id?: string;
  candidate_k?: number;
  top_k?: number;
  alpha?: number;
  fusion_mode?: "rrf" | "weighted";
  current_version_only?: boolean;
  min_threshold?: number;
  enable_rerank?: boolean;
  min_relevance_threshold?: number;
}

export const searchService = {
  async executeHybridSearch(params: SearchQueryParams): Promise<RetrievalSearchResponse> {
    return api.post<RetrievalSearchResponse>("/api/v1/search/retrieve", {
      query: params.query,
      project_id: params.project_id || undefined,
      department_id: params.department_id || undefined,
      candidate_k: params.candidate_k ?? 20,
      top_k: params.top_k ?? 5,
      alpha: params.alpha ?? 0.5,
      fusion_mode: params.fusion_mode ?? "rrf",
      current_version_only: params.current_version_only ?? true,
      min_threshold: params.min_threshold ?? 0.0,
      enable_rerank: params.enable_rerank ?? true,
      min_relevance_threshold: params.min_relevance_threshold ?? 0.25,
    });
  },

  async getProjects(): Promise<ProjectSummary[]> {
    try {
      return await api.get<ProjectSummary[]>("/api/v1/projects");
    } catch {
      return [];
    }
  },
};
