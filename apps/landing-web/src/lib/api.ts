const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

// API serverdagi statik fayllarga (masalan, taom/o'qituvchi rasmlariga) to'liq
// havola quramiz — backend faqat "/uploads/..." kabi nisbiy yo'l qaytaradi.
export function assetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
}

/**
 * Lending sahifa kontenti (jadval, taomlar, o'qituvchilar, matnli bloklar)
 * — ochiq (autentifikatsiyasiz) endpointlardan o'qiladi. `no-store`: admin
 * platform-web'da o'zgartirsa, tashrif buyuruvchi darhol yangi holatni
 * ko'rishi kerak — eski kesh emas. API vaqtincha ishlamay qolsa ham
 * marketing sayt buzilib qolmasligi uchun xatolik bo'lganda bo'sh natija
 * (fallback) qaytariladi.
 */
export async function fetchLanding<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/app/landing${path}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    const body = (await res.json()) as Envelope<T>;
    return body.data ?? fallback;
  } catch {
    return fallback;
  }
}

export interface LandingApplicationInput {
  fullName: string;
  phone: string;
}

/** `message` — backenddan kelgan haqiqiy xabar bo'lsa shu qaytariladi, aks holda
 *  `null` — chaqiruvchi tomon (tarjima qila oladigan komponent) o'z zaxira
 *  matnini ko'rsatadi. */
type SubmitResult = { ok: true } | { ok: false; message: string | null };

/** "Ariza qoldirish" formasini serverga yuboradi. */
export async function submitLandingApplication(input: LandingApplicationInput): Promise<SubmitResult> {
  try {
    const res = await fetch(`${API_URL}/app/landing/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!res.ok) {
      return { ok: false, message: body?.error?.message ?? null };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: null };
  }
}
