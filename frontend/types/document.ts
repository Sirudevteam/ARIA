export type DocStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "ARCHIVED";

export type DocType =
  | "manual"
  | "spec"
  | "faq"
  | "guide"
  | "annotation_schema"
  | "other";

export type ConfidentialityLevel =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export interface DocumentVersion {
  id: string;
  version_number: number;
  storage_path: string;
  file_size_bytes?: number;
  checksum?: string;
  change_summary?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  is_current: boolean;
}

export interface DocumentItem {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  project_name?: string;
  department_id?: string;
  department_name?: string;
  doc_type: DocType | string;
  current_version_number: number;
  status: DocStatus;
  confidentiality: ConfidentialityLevel | string;
  author?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  file_size_bytes?: number;
  mime_type?: string;
  page_count?: number;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends DocumentItem {
  versions: DocumentVersion[];
  metadata?: Record<string, unknown>;
}

export interface DocumentListResponse {
  items: DocumentItem[];
  total: number;
  page: number;
  limit: number;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
}
