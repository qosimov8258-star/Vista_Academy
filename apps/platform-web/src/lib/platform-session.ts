// Platform Super Admin foydalanuvchisining access/refresh tokenlari shu yerda,
// sessionStorage'da saqlanadi — u har bir brauzer tab'i uchun mustaqil.
// Cookie esa butun origin uchun umumiy: bitta tabda chiqilsa, cookie
// tozalanib, boshqa tabdagi sessiyani ham "o'zi bilan" yopib qo'yardi. Bu
// yerdagi token Authorization header orqali yuborilib, shu muammoning
// oldini oladi.

const ACCESS_KEY = "bogcha_platform_at";
const REFRESH_KEY = "bogcha_platform_rt";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getPlatformAccessToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getPlatformRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setPlatformTokens(tokens: { accessToken: string; refreshToken: string }): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearPlatformTokens(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}
