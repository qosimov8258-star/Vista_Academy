// Ota-ona kabinetining access/refresh tokenlari shu yerda, sessionStorage'da
// saqlanadi — u har bir brauzer tab'i uchun mustaqil. Cookie esa butun
// origin uchun umumiy: bitta tabda chiqilsa, cookie tozalanib, boshqa
// tabdagi ota-ona sessiyasini ham yopib qo'yardi. Bu yerdagi token
// Authorization header orqali yuborilib, shu muammoning oldini oladi.

const ACCESS_KEY = "bogcha_parent_at";
const REFRESH_KEY = "bogcha_parent_rt";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getParentAccessToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getParentRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setParentTokens(tokens: { accessToken: string; refreshToken: string }): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearParentTokens(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}
