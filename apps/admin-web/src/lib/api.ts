const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/app/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401 && retry && !path.startsWith("/app/auth")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body: Envelope<T> | null = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok || !body?.success) {
    const error = body?.error;
    throw new ApiError(res.status, error?.code ?? "ERROR", error?.message ?? res.statusText, error?.details);
  }

  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export async function getPaginated<T>(path: string): Promise<Paginated<T>> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
  const body = (await res.json()) as Envelope<T[]>;
  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.error?.code ?? "ERROR", body.error?.message ?? res.statusText);
  }
  return { data: body.data as T[], meta: (body.meta as Paginated<T>["meta"]) ?? { page: 1, limit: 20, total: 0 } };
}
