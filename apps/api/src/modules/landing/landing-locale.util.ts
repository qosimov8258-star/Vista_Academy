/// Lending sahifa (landing-web) kontentini ko'p tilli qilish uchun yordamchilar.
/// Har bir tarjima qilinadigan maydon uchun bazada uchta ustun bor: asosiy
/// (uz, har doim to'ldirilgan) va ixtiyoriy `*Ru`/`*En`. Bu yerdagi funksiyalar
/// so'ralgan tilga mos qiymatni tanlaydi — ru/en bo'sh bo'lsa, uz (asosiy)
/// ustunga qaytadi, shunday qilib admin hali tarjima kiritmagan yozuvlar ham
/// sayt uchun bo'sh ko'rinmaydi.

export type LandingLocale = "uz" | "ru" | "en";

const LANDING_LOCALES: readonly LandingLocale[] = ["uz", "ru", "en"];

export function resolveLandingLocale(value: string | undefined): LandingLocale {
  return (LANDING_LOCALES as readonly string[]).includes(value ?? "") ? (value as LandingLocale) : "uz";
}

function pick(base: string, ru: string | null | undefined, en: string | null | undefined, locale: LandingLocale): string {
  if (locale === "ru" && ru) return ru;
  if (locale === "en" && en) return en;
  return base;
}

function pickNullable(
  base: string | null,
  ru: string | null | undefined,
  en: string | null | undefined,
  locale: LandingLocale,
): string | null {
  if (!base) return base;
  return pick(base, ru, en, locale);
}

export function localizeScheduleItem<T extends { title: string; titleRu: string | null; titleEn: string | null }>(
  item: T,
  locale: LandingLocale,
): Omit<T, "titleRu" | "titleEn"> {
  const { titleRu, titleEn, ...rest } = item;
  return { ...rest, title: pick(item.title, titleRu, titleEn, locale) };
}

export function localizeMeal<
  T extends {
    title: string;
    description: string | null;
    titleRu: string | null;
    titleEn: string | null;
    descriptionRu: string | null;
    descriptionEn: string | null;
  },
>(item: T, locale: LandingLocale): Omit<T, "titleRu" | "titleEn" | "descriptionRu" | "descriptionEn"> {
  const { titleRu, titleEn, descriptionRu, descriptionEn, ...rest } = item;
  return {
    ...rest,
    title: pick(item.title, titleRu, titleEn, locale),
    description: pickNullable(item.description, descriptionRu, descriptionEn, locale),
  };
}

export function localizeTeacher<
  T extends {
    role: string;
    bio: string | null;
    experience: string | null;
    roleRu: string | null;
    roleEn: string | null;
    bioRu: string | null;
    bioEn: string | null;
    experienceRu: string | null;
    experienceEn: string | null;
  },
>(
  item: T,
  locale: LandingLocale,
): Omit<T, "roleRu" | "roleEn" | "bioRu" | "bioEn" | "experienceRu" | "experienceEn"> {
  const { roleRu, roleEn, bioRu, bioEn, experienceRu, experienceEn, ...rest } = item;
  return {
    ...rest,
    role: pick(item.role, roleRu, roleEn, locale),
    bio: pickNullable(item.bio, bioRu, bioEn, locale),
    experience: pickNullable(item.experience, experienceRu, experienceEn, locale),
  };
}

export function localizeContentBlock<
  T extends { title: string; body: string; titleRu: string | null; titleEn: string | null; bodyRu: string | null; bodyEn: string | null },
>(item: T, locale: LandingLocale): Omit<T, "titleRu" | "titleEn" | "bodyRu" | "bodyEn"> {
  const { titleRu, titleEn, bodyRu, bodyEn, ...rest } = item;
  return {
    ...rest,
    title: pick(item.title, titleRu, titleEn, locale),
    body: pick(item.body, bodyRu, bodyEn, locale),
  };
}

export function localizeGroupStudent<T extends { bio: string | null; bioRu: string | null; bioEn: string | null }>(
  item: T,
  locale: LandingLocale,
): Omit<T, "bioRu" | "bioEn"> {
  const { bioRu, bioEn, ...rest } = item;
  return { ...rest, bio: pickNullable(item.bio, bioRu, bioEn, locale) };
}
