/**
 * Ilovani o'rnatish (PWA) — umumiy yordamchilar.
 *
 * Har bir bog'chaning ikkita ilovasi bor: xodimlar paneli (`staff`) va
 * ota-onalar kabineti (`parent`). Manifest `/_pwa/manifest?org=..&app=..`
 * dan keladi (nomi — bog'cha nomi). O'rnatish ixtiyoriy: bosh sahifada
 * `InstallBanner` qatori turadi (yopish tugmasi yo'q), ilova o'rnatilgach
 * o'zi yo'qoladi.
 */

export type PwaApp = "staff" | "parent";

/** `<link rel="manifest">` manzili — proxy `_pwa/` ga tegmaydi */
export function pwaManifestHref(slug: string, app: PwaApp): string {
  return `/_pwa/manifest?org=${encodeURIComponent(slug.toLowerCase())}&app=${app}`;
}

/** Shu brauzerda ilova o'rnatilgani (appinstalled) eslab qolinadigan kalit */
export function pwaInstalledKey(slug: string, app: PwaApp): string {
  return `pwa-installed:${app}:${slug.toLowerCase()}`;
}

/**
 * Chrome `beforeinstallprompt` ni sahifa yuklanishi bilan bir marta yuboradi —
 * React hali chizilmagan bo'lsa ham yo'qolmasin. Root layout `<head>` ga
 * qo'yiladi: hodisa `window.__pwaPrompt` da saqlanadi va `pwa-prompt` bilan
 * xabar beriladi. `preventDefault` — Chrome'ning o'z kichik oynasi chiqmaydi
 * (o'rnatish bizning tugmamiz orqali).
 */
export const PWA_BOOT_SCRIPT = `(function(){try{
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event("pwa-prompt"));});
window.addEventListener("appinstalled",function(){window.__pwaInstalled=true;window.__pwaPrompt=null;window.dispatchEvent(new Event("pwa-installed"));});
}catch(e){}})();`;

/** Chrome'ning o'rnatish hodisasi (standart TS turlarida yo'q) */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
    __pwaInstalled?: boolean;
  }
  interface Navigator {
    /** iOS Safari: bosh ekrandan ochilganmi */
    standalone?: boolean;
    getInstalledRelatedApps?: () => Promise<Array<{ platform: string; url?: string; id?: string }>>;
  }
}

/** Sahifa o'rnatilgan ilovaning o'zida (alohida oynada) ochilganmi */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.standalone === true) return true;
  return ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

/**
 * Qurilma va brauzer — qaysi yo'l bilan o'rnatish mumkinligi:
 * - `chromium` — Chrome, Edge, Samsung, Opera, Yandex (Android va kompyuter): o'rnatish tugmasi;
 * - `ios` — iPhone/iPad (Safari, Chrome, Edge): «Ulashish → Bosh ekranga qo'shish» ko'rsatmasi;
 * - `mac-safari` — macOS Safari 17+: «Fayl → Dock'ga qo'shish»;
 * - `blocked` — o'rnatib bo'lmaydi (Firefox, Telegram/Instagram ichidagi brauzer, eski Safari).
 */
export type PwaPlatform =
  | { kind: "chromium"; mobile: boolean }
  | { kind: "ios"; browser: "safari" | "chrome" | "edge" }
  | { kind: "mac-safari" }
  | { kind: "blocked"; os: "android" | "ios" | "other"; inApp: boolean };

export function detectPlatform(): PwaPlatform {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const os = android ? "android" : ios ? "ios" : "other";
  // Ilova ichidagi brauzerlar (Telegram, Instagram, Facebook...) va Android WebView.
  // iOS'da ular «Safari/» belgisisiz keladi (WKWebView).
  const inApp =
    /FBAN|FBAV|FB_IAB|Instagram|Line\/|Telegram|MicroMessenger|Snapchat|musical_ly|TikTok|; wv\)/.test(ua) ||
    (ios && !/Safari\//.test(ua));
  if (inApp) return { kind: "blocked", os, inApp: true };
  if (/Firefox|FxiOS/.test(ua)) return { kind: "blocked", os, inApp: false };
  if (ios) return { kind: "ios", browser: /CriOS/.test(ua) ? "chrome" : /EdgiOS/.test(ua) ? "edge" : "safari" };
  if (/Chrome\/|Chromium|Edg\/|SamsungBrowser|OPR\/|YaBrowser/.test(ua)) return { kind: "chromium", mobile: android };
  const safari = /Macintosh/.test(ua) && /Safari\//.test(ua) ? ua.match(/Version\/(\d+)/) : null;
  if (safari && Number(safari[1]) >= 17) return { kind: "mac-safari" };
  return { kind: "blocked", os, inApp: false };
}
