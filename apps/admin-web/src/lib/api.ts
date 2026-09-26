import { clearTenantTokens, getTenantAccessToken, getTenantRefreshToken, setTenantTokens } from "./tenant-session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

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
    const refreshToken = getTenantRefreshToken();
    refreshPromise = fetch(`${API_URL}/app/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearTenantTokens();
          return false;
        }
        const body: Envelope<{ accessToken: string; refreshToken: string }> | null = await res
          .json()
          .catch(() => null);
        if (body?.data) {
          setTenantTokens(body.data);
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const accessToken = getTenantAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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

async function upload<T>(path: string, file: File, retry = true): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const accessToken = getTenantAccessToken();

  // Content-Type ni qo'lda qo'ymaymiz — brauzer multipart boundary'ni o'zi qo'shadi.
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return upload<T>(path, file, false);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body: Envelope<T> | null = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok || !body?.success) {
    const error = body?.error;
    if (res.status === 401) {
      throw new ApiError(401, "UNAUTHORIZED", "Sessiya muddati tugadi. Sahifani yangilang va qaytadan urinib ko'ring.");
    }
    throw new ApiError(res.status, error?.code ?? "ERROR", error?.message ?? res.statusText, error?.details);
  }

  return body.data as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { method: "GET", ...init }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { method: "DELETE", ...init }),
  upload: <T>(path: string, file: File) => upload<T>(path, file),
};

/** Backend faqat "/uploads/..." kabi nisbiy yo'l qaytaradi — to'liq manzilga aylantiradi. */
export function assetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export async function getPaginated<T>(path: string): Promise<Paginated<T>> {
  const accessToken = getTenantAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const body = (await res.json()) as Envelope<T[]>;
  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.error?.code ?? "ERROR", body.error?.message ?? res.statusText);
  }
  return { data: body.data as T[], meta: (body.meta as Paginated<T>["meta"]) ?? { page: 1, limit: 20, total: 0 } };
}
