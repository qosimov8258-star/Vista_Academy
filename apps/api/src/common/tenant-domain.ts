/**
 * Bog'chalar o'z subdomenida ishlaydi: `<slug>.<TENANT_BASE_DOMAIN>`
 * (masalan babyland.zeeron.uz). Shu yerda — subdomen bo'la oladigan slug
 * qoidalari va brauzer manzili (Origin) shu domenga tegishlimi, degan
 * tekshiruv. TENANT_BASE_DOMAIN berilmasa, subdomen rejimi o'chiq.
 */

/** Tashkilot nomi sifatida olib bo'lmaydigan subdomenlar (xizmat manzillari). */
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "admin",
  "platform",
  "api",
  "app",
  "mail",
  "smtp",
  "ftp",
  "static",
  "cdn",
  "assets",
  "status",
  "help",
  "support",
  "ota-ona",
]);

/** DNS yorlig'i 63 belgigacha; o'qishga qulay bo'lishi uchun qisqaroq. */
export const MAX_TENANT_SLUG_LENGTH = 40;

const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isValidTenantSlug(slug: string): boolean {
  return slug.length <= MAX_TENANT_SLUG_LENGTH && LABEL.test(slug) && !RESERVED_SUBDOMAINS.has(slug);
}

export function tenantBaseDomain(): string | null {
  const raw = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase();
  return raw ? raw.replace(/^\.+|\.+$/g, "") : null;
}

/**
 * Origin bog'cha subdomenimi: https://<slug>.<domen> (lokalda — http
 * ham, masalan http://babyland.localhost:3101).
 */
export function isTenantOrigin(origin: string | undefined | null): boolean {
  const base = tenantBaseDomain();
  if (!origin || !base) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const local = base === "localhost";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return false;
  const suffix = `.${base}`;
  if (!url.hostname.endsWith(suffix)) return false;
  const label = url.hostname.slice(0, -suffix.length);
  return LABEL.test(label) && !label.includes(".");
}
