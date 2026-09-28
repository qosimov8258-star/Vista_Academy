const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, "") ?? "";

/**
 * Lending sahifadagi statik dizayn fayllari (rasm, video, animatsiya)
 * uchun to'liq havola quradi. `NEXT_PUBLIC_CDN_URL` (Cloudflare R2 ochiq
 * domeni) sozlansa — o'sha yerdan, aks holda `public/` papkasidan (lokal
 * ishlab chiqish uchun zaxira) beriladi. Admin panelda yuklangan dinamik
 * fayllar (guruh/o'quvchi suratlari) uchun `assetUrl` (`./api.ts`) ishlatiladi.
 */
export function cdn(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return CDN_URL ? `${CDN_URL}${normalized}` : normalized;
}

/** `cdn()` natijasi hali nisbiy bo'lsa (CDN sozlanmagan), uni saytning o'z
 *  domeni bilan to'liq havolaga aylantiradi — JSON-LD kabi joylarda
 *  har doim absolyut URL talab qilinadi. */
export function absoluteMediaUrl(path: string, siteUrl: string): string {
  const url = cdn(path);
  return /^https?:\/\//.test(url) ? url : `${siteUrl}${url}`;
}
