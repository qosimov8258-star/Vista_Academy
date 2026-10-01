/**
 * Har bir bog'cha platform panelida o'z mustaqil lending saytining domenini
 * ("Veb-sayt" maydoni) kiritadi — masalan "vista-academy.uz" yoki
 * "https://vista-academy.uz/". Bu domen keyinchalik ikki joyda ishlatiladi:
 * saqlashdan oldin `Organization.website`ni normallashtirishda, va har bir
 * "Ariza qoldirish" so'rovining Origin/Referer sarlavhasidan olingan hostni
 * bazadagi qiymat bilan solishtirishda. Ikkalasida ham AYNAN shu funksiya
 * qo'llanilishi shart — aks holda "https://Vista-Academy.uz/" va
 * "vista-academy.uz" turlicha qiymat sifatida ko'rinib, moslik topilmay
 * qolardi.
 */
export function normalizeWebsiteHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return host || null;
}
