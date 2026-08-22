export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  environment: string;
  database: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  detail?: unknown;
}
