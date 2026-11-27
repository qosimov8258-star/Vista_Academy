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

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** `null` holat — javob umuman kelmadi (tarmoq uzilgan) */
type RefreshAttempt = { ok: true; tokens: TokenPair | null } | { ok: false; status: number | null };

async function postRefresh(refreshToken: string | null): Promise<RefreshAttempt> {
  try {
    const res = await fetch(`${API_URL}/app/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body: Envelope<TokenPair> | null = await res.json().catch(() => null);
    return { ok: true, tokens: body?.data ?? null };
  } catch {
    return { ok: false, status: null };
  }
}

/** Token API'ning o'zi rad etgani (seans haqiqatan yaroqsiz) — vaqtinchalik server/tarmoq xatosi emas */
function isRejected(attempt: RefreshAttempt): boolean {
  return !attempt.ok && attempt.status !== null && attempt.status >= 400 && attempt.status < 500;
}

/**
 * Tokenning egasi: foydalanuvchi va (xodim profiliga kirilgan bo'lsa) kirgan admin.
 * Imzo tekshirilmaydi — faqat ikki tokenni solishtirish uchun.
 */
function tokenOwner(token: string | null): string | null {
  const segment = token?.split(".")[1];
  if (!segment) return null;
  try {
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "="));
    const payload = JSON.parse(json) as { sub?: string; issuerId?: string };
    return payload.sub ? `${payload.sub}|${payload.issuerId ?? ""}` : null;
  } catch {
    return null;
  }
}

/**
 * Access token muddati o'tganda yangilaydi. `request()` ichida avtomatik
 * chaqiriladi; token talab qiladigan lekin JSON javob kutmaydigan so'rovlar
 * (masalan `<img>` o'rniga blob bilan yuklanadigan surat) ham shu funksiyani
 * qayta ishlatadi — aks holda ular 401'da hech qachon qayta urinmaydi.
 *
 * Avval tabning o'z refresh tokeni ishlatiladi. U rad etilsa — brauzerning
 * umumiy cookie'sidagi eng so'nggi refresh token bilan bir marta urinadi.
 * Sabab: o'rnatilgan ilova (PWA) alohida oyna — uning sessionStorage'i bo'sh
 * ochiladi va u cookie orqali yangilanadi. Refresh token har yangilanishda
 * almashadi (eskisi bekor bo'ladi), shuning uchun ilova va Chrome tabi
 * navbatma-navbat bir-birining tokenini bekor qilib qo'yardi: tarbiyachi
 * ilovaga qaytganda davomat «Unauthorized» bilan yuklanmas va saqlanmasdi.
 * Cookie'dagi seans boshqa foydalanuvchiniki bo'lsa, u qabul qilinmaydi —
 * tab boshqa odamga aylanib qolmasin.
 */
export async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshSession(): Promise<boolean> {
  const ownRefreshToken = getTenantRefreshToken();
  const owner = tokenOwner(getTenantAccessToken());

  if (ownRefreshToken) {
    const own = await postRefresh(ownRefreshToken);
    if (own.ok) {
      if (own.tokens) setTenantTokens(own.tokens);
      return true;
    }
    // Tarmoq yoki server xatosi — seans tugamagan, tokenlar keyingi urinish uchun qoladi
    if (!isRejected(own)) return false;
  }

  const shared = await postRefresh(null);
  if (!shared.ok) {
    if (isRejected(shared) || ownRefreshToken) clearTenantTokens();
    return false;
  }
  if (shared.tokens) {
    if (owner && tokenOwner(shared.tokens.accessToken) !== owner) {
      clearTenantTokens();
      return false;
    }
    setTenantTokens(shared.tokens);
  }
  return true;
}

/**
 * Token bilan oddiy `fetch` (JSON konvertsiz javoblar: fayl, rasm, sahifali
 * ro'yxat) — 401 da tokenni yangilab, bir marta qayta urinadi.
 */
export async function authFetch(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const accessToken = getTenantAccessToken();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, credentials: "include", headers });
  if (res.status === 401 && retry && (await tryRefresh())) {
    return authFetch(url, init, false);
  }
  return res;
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

async function upload<T>(path: string, file: File, retry = true, fields?: Record<string, string>): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  for (const [key, value] of Object.entries(fields ?? {})) formData.append(key, value);
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
      return upload<T>(path, file, false, fields);
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
  /** `fields` — fayl bilan birga yuboriladigan oddiy maydonlar (multipart) */
  upload: <T>(path: string, file: File, fields?: Record<string, string>) => upload<T>(path, file, true, fields),
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
  // Avval bu yerda 401'da token yangilanmasdi: ilova fondan qaytganda
  // (15 daqiqadan keyin) tarbiyachining «Bolalar» ro'yxati kabi sahifali
  // ro'yxatlar «Unauthorized» bilan yuklanmay qolardi.
  const res = await authFetch(`${API_URL}${path}`);
  const body = (await res.json()) as Envelope<T[]>;
  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.error?.code ?? "ERROR", body.error?.message ?? res.statusText);
  }
  return { data: body.data as T[], meta: (body.meta as Paginated<T>["meta"]) ?? { page: 1, limit: 20, total: 0 } };
}
