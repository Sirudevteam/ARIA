export const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    // If running in browser over HTTPS (production) and envUrl is localhost, fallback to relative path (proxied by Next.js rewrites)
    if (!envUrl || (window.location.protocol === "https:" && envUrl.includes("localhost"))) {
      return "";
    }
    return envUrl.replace(/\/$/, "");
  }
  return (envUrl ?? "http://localhost:8000").replace(/\/$/, "");
};

const BASE_URL = getBaseUrl();

export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Global token cache for active session
let activeAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  activeAuthToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("aria_auth_token", token);
    } else {
      localStorage.removeItem("aria_auth_token");
    }
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;

    // 1. Try Clerk session token
    // @ts-expect-error Clerk is injected onto window in browser
    if (window.Clerk?.session) {
      // @ts-expect-error Clerk session getToken
      const clerkToken = await window.Clerk.session.getToken();
      if (clerkToken) return clerkToken;
    }

    // 2. Active token or local storage demo token
    if (activeAuthToken) return activeAuthToken;
    return localStorage.getItem("aria_auth_token");
  } catch {
    return activeAuthToken;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;

  // Automatically attach Supabase access token if available and not overridden
  const token = await getAuthToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const json = await res.json();
      errorDetail = json.detail || json.message || JSON.stringify(json);
    } catch {
      errorDetail = await res.text();
    }
    throw new APIError(res.status, `HTTP ${res.status}: ${errorDetail}`, errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "GET", ...options }),
  post: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    }),
  patch: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...options }),
};
