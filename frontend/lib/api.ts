export const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    // Client-side: use relative paths (the Next.js route handler proxy handles it)
    if (!envUrl || (window.location.protocol === "https:" && envUrl.includes("localhost"))) {
      return "";
    }
    return envUrl.replace(/\/$/, "");
  }
  // Server-side: use BACKEND_URL for Server Components / Route Handlers
  const serverUrl = process.env.BACKEND_URL || envUrl || "http://localhost:8000";
  return serverUrl.replace(/\/$/, "");
};

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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
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
