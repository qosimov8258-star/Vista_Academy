import { cache } from "react";
import type { Metadata } from "next";

/**
 * Sahifa sarlavhasi va havola ko'rinishi (Telegram, WhatsApp) — har bir
 * bog'chaning o'z nomi bilan. Panel hamma bog'chalar uchun bitta, shuning
 * uchun bu yerda hech qaysi bog'cha nomi qattiq yozilmaydi: nom API'ning
 * ochiq `by-slug` endpointidan olinadi (faqat nom va slug qaytaradi).
 */

/** Bog'cha aniqlanmaganda (admin. domeni, umumiy sahifalar). */
export const DEFAULT_METADATA: Metadata = {
  title: "Zeeron — bog'cha paneli",
  description: "Bog'cha boshqaruv paneli va ota-onalar kabineti",
  openGraph: { siteName: "Zeeron", type: "website" },
};

/**
 * Server tomondan API manzili. Brauzer `/api/v1` ni nginx (serverda) yoki
 * next.config rewrites (lokalda, API_PROXY_TARGET) orqali chaqiradi;
 * serverdagi Next esa API'ga to'g'ridan-to'g'ri boradi — u shu mashinada.
 */
function apiOrigin(): string {
  const origin = process.env.API_INTERNAL_URL ?? process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
  return origin.replace(/\/+$/, "");
}

/** Bitta so'rov ichida layout'lar takror chaqirsa ham API'ga bir marta boriladi. */
const fetchOrganizationName = cache(async (slug: string): Promise<string | null> => {
  try {
    const res = await fetch(`${apiOrigin()}/api/v1/app/organizations/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
      // API sekin javob bersa sahifa kutib qolmasin — sarlavhasiz ham ochiladi
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { name?: unknown } };
    const name = body.data?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
});

export async function tenantMetadata(slug: string | null | undefined): Promise<Metadata> {
  const name = slug ? await fetchOrganizationName(slug.toLowerCase()) : null;
  if (!name) return DEFAULT_METADATA;
  // Xodim ham, ota-ona ham shu havolani oladi — sarlavha faqat bog'cha nomi
  const description = `${name}: bog'cha boshqaruv paneli va ota-onalar kabineti`;
  return {
    title: name,
    description,
    openGraph: { title: name, description, siteName: "Zeeron", type: "website" },
    twitter: { card: "summary", title: name, description },
  };
}
