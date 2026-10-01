/** Joriy til uchun tarjima lug'ati (o'zbekcha uchun bo'sh — matn o'zi kalit). */
export async function loadDict(locale: string): Promise<Record<string, string>> {
  if (locale === "ru") return (await import("../../messages/dict.ru.json")).default;
  if (locale === "en") return (await import("../../messages/dict.en.json")).default;
  return {};
}
