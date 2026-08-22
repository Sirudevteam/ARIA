import { api } from "@/lib/api";
import type { HealthResponse } from "@/types/api";

/**
 * Fetch the backend health status.
 * Returns null if the backend is unreachable.
 */
export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    return await api.get<HealthResponse>("/api/v1/health");
  } catch {
    return null;
  }
}
