"use client";

import { ApiError } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Ota-ona kabineti uchun alohida mijoz: u `/app/parent/refresh` ga murojaat
 * qiladi va xodimlar mijozidan (lib/api.ts) butunlay ajratilgan. Ikkalasi
 * bir funksiyaga birlashtirilsa, ota-ona tokeni tugaganda xodim seansini
 * yangilashga urinib qolish xavfi bo'lardi.
 */
async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/app/parent/refresh`, { method: "POST", credentials: "include" })
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
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 401 && retry && !path.endsWith("/login") && !path.endsWith("/refresh")) {
    if (await tryRefresh()) {
      return request<T>(path, options, false);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body: Envelope<T> | null = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok || !body?.success) {
    throw new ApiError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? res.statusText);
  }
  return body.data as T;
}

export const parentApi = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
};

export const PARENT_API_URL = API_URL;
