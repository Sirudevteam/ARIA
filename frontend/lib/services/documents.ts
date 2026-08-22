import { api, APIError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import {
  Department,
  DocumentDetail,
  DocumentListResponse,
  ProjectSummary,
} from "@/types/document";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface DocumentFilters {
  q?: string;
  project_id?: string;
  department_id?: string;
  status?: string;
  doc_type?: string;
  confidentiality?: string;
  page?: number;
  limit?: number;
}

export const documentsService = {
  async listDocuments(filters: DocumentFilters = {}): Promise<DocumentListResponse> {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.project_id) params.set("project_id", filters.project_id);
    if (filters.department_id) params.set("department_id", filters.department_id);
    if (filters.status) params.set("status", filters.status);
    if (filters.doc_type) params.set("doc_type", filters.doc_type);
    if (filters.confidentiality) params.set("confidentiality", filters.confidentiality);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));

    const queryString = params.toString();
    const endpoint = `/api/v1/documents${queryString ? `?${queryString}` : ""}`;
    return api.get<DocumentListResponse>(endpoint);
  },

  async getDocument(documentId: string): Promise<DocumentDetail> {
    return api.get<DocumentDetail>(`/api/v1/documents/${documentId}`);
  },

  async uploadDocument(
    projectId: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<DocumentDetail> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = `${BASE_URL}/api/v1/projects/${projectId}/documents/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error("Invalid JSON response from server"));
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(new APIError(xhr.status, errJson.detail || "Upload failed", errJson.detail));
          } catch {
            reject(new APIError(xhr.status, xhr.statusText || "Upload failed"));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during document upload."));
      };

      xhr.send(formData);
    });
  },

  async uploadNewVersion(
    documentId: string,
    formData: FormData
  ): Promise<DocumentDetail> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = `${BASE_URL}/api/v1/documents/${documentId}/versions`;

    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new APIError(res.status, err.detail || "Failed to upload new version", err.detail);
    }

    return res.json();
  },

  async toggleArchive(documentId: string, archive: boolean): Promise<DocumentDetail> {
    return api.patch<DocumentDetail>(
      `/api/v1/documents/${documentId}/archive?archive=${archive}`,
      {}
    );
  },

  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    return api.delete<{ success: boolean; message: string }>(
      `/api/v1/documents/${documentId}`
    );
  },

  async downloadDocument(
    documentId: string,
    versionNumber?: number,
    suggestedFilename?: string
  ): Promise<void> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const url = `${BASE_URL}/api/v1/documents/${documentId}/download${
      versionNumber ? `?version_number=${versionNumber}` : ""
    }`;

    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = suggestedFilename || `document_${documentId}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },

  async getDepartments(): Promise<Department[]> {
    try {
      return await api.get<Department[]>("/api/v1/departments");
    } catch {
      return [];
    }
  },

  async getProjects(): Promise<ProjectSummary[]> {
    try {
      const data = await api.get<ProjectSummary[]>("/api/v1/projects");
      return data;
    } catch {
      return [];
    }
  },
};
