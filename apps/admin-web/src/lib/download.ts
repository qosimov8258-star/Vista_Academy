import { getTenantAccessToken } from "./tenant-session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Himoyalangan faylni (hujjat, rasm, PDF) yangi oynada ochadi. Oyna darhol
 * ochiladi (brauzer uni popup deb to'smasin), fayl esa token bilan olinib,
 * keyin unga qo'yiladi.
 */
export async function openFile(path: string): Promise<void> {
  const win = window.open("about:blank", "_blank");
  try {
    const accessToken = getTenantAccessToken();
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!res.ok) throw new Error("Faylni ochib bo'lmadi");
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    win?.close();
    throw error;
  }
}

/**
 * Himoyalangan faylni (token bilan) yuklab, sahifa ichida ko'rsatish uchun
 * vaqtinchalik URL qaytaradi — masalan ovozli vazifani shu yerning o'zida
 * tinglash. Ishlatib bo'lgach `URL.revokeObjectURL` qilinadi.
 */
export async function fetchFileUrl(path: string): Promise<string> {
  const accessToken = getTenantAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) throw new Error("Faylni ochib bo'lmadi");
  return URL.createObjectURL(await res.blob());
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const accessToken = getTenantAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) {
    throw new Error("Eksport qilishda xatolik yuz berdi");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
