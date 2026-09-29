/**
 * Bog'cha subdomeni: `<slug>.<NEXT_PUBLIC_TENANT_BASE_DOMAIN>`
 * (babyland.zeeron.uz; lokalda babyland.localhost:3101).
 *
 * Subdomenda manzillar toza (`/attendance`, `/ota-ona`), ilova ichida esa
 * sahifalar avvalgidek `/{slug}/...` yo'lida turadi — `proxy.ts` ularni
 * bir-biriga o'giradi. Domen berilmasa subdomen rejimi o'chiq va hammasi
 * avvalgidek `/{slug}/...` manzillarda ishlaydi.
 */

/** proxy.ts subdomendagi so'rovga qo'yadi, root layout o'qiydi. */
export const TENANT_SLUG_HEADER = "x-tenant-slug";

export const TENANT_BASE_DOMAIN = (process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN ?? "").trim().toLowerCase() || null;

/** Subdomen bo'la olmaydigan (xizmat) nomlar — API'dagi ro'yxat bilan bir xil. */
const RESERVED = new Set(["www", "admin", "platform", "api", "app", "mail", "smtp", "ftp", "static", "cdn", "assets", "status", "help", "support", "ota-ona"]);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** `Host` sarlavhasidan bog'cha slug'i; subdomen bo'lmasa `null`. */
export function tenantSlugFromHost(host: string | null | undefined): string | null {
  if (!host || !TENANT_BASE_DOMAIN) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const suffix = `.${TENANT_BASE_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;
  const label = hostname.slice(0, -suffix.length);
  return LABEL.test(label) && !RESERVED.has(label) ? label : null;
}

/**
 * Brauzer manzilidagi yo'l → ilova ichidagi yo'l.
 * babyland subdomenida: "/attendance" → "/babyland/attendance",
 * "/ota-ona/kundalik" → "/ota-ona/babyland/kundalik".
 */
export function toInternalPath(pathname: string, hostSlug: string | null): string {
  if (!hostSlug) return pathname;
  if (pathname === "/ota-ona" || pathname.startsWith("/ota-ona/")) {
    return `/ota-ona/${hostSlug}${pathname.slice("/ota-ona".length)}`;
  }
  return `/${hostSlug}${pathname === "/" ? "" : pathname}`;
}

/**
 * Ilova ichidagi yo'l → subdomendagi toza yo'l (teskarisi). Slug bilan
 * boshlanmasa `null` — o'zgartirish kerak emas.
 */
export function toExternalPath(pathname: string, hostSlug: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === hostSlug) {
    return `/${segments.slice(1).join("/")}`;
  }
  if (segments[0] === "ota-ona" && segments[1] === hostSlug) {
    const rest = segments.slice(2).join("/");
    return rest ? `/ota-ona/${rest}` : "/ota-ona";
  }
  return null;
}
