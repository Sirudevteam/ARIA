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
  match_channel: "both" | "vector_only" | "keyword_only" | string;
  metadata: Record<string, unknown>;
}

export interface RetrievalSearchResponse {
  query: string;
  total_results: number;
  top_k: number;
  alpha: number;
  fusion_mode: string;
  results: RetrievedChunkResult[];
}

export interface SearchQueryParams {
  query: string;
  project_id?: string;
  department_id?: string;
  top_k?: number;
  alpha?: number;
  fusion_mode?: "rrf" | "weighted";
  current_version_only?: boolean;
  min_threshold?: number;
}

export const searchService = {
  async executeHybridSearch(params: SearchQueryParams): Promise<RetrievalSearchResponse> {
    return api.post<RetrievalSearchResponse>("/api/v1/search/retrieve", {
      query: params.query,
      project_id: params.project_id || undefined,
      department_id: params.department_id || undefined,
      top_k: params.top_k ?? 5,
      alpha: params.alpha ?? 0.5,
      fusion_mode: params.fusion_mode ?? "rrf",
      current_version_only: params.current_version_only ?? true,
      min_threshold: params.min_threshold ?? 0.0,
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
