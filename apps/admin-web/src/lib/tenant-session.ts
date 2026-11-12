// Tarmoq (tenant) foydalanuvchisining access/refresh tokenlari shu yerda,
// sessionStorage'da saqlanadi — u har bir brauzer tab'i uchun mustaqil.
// Cookie esa butun origin uchun umumiy: bitta tabda boshqa foydalanuvchi
// (masalan tarbiyachi) kirsa, cookie qayta yozilib, avvalgi tabdagi
// (masalan admin) sessiyani ham "bosib ketardi". Bu yerdagi token
// Authorization header orqali yuborilib, shu muammoning oldini oladi.

const ACCESS_KEY = "bogcha_tenant_at";
const REFRESH_KEY = "bogcha_tenant_rt";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getTenantAccessToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getTenantRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setTenantTokens(tokens: { accessToken: string; refreshToken: string }): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTenantTokens(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}
