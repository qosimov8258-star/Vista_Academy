/** Fan tanlovi talab qilinadigan yagona lavozim. */
export const SUBJECT_TEACHER_POSITION = "fan o'qituvchisi";

/** Turli tirnoq belgilari (', ', `) bilan kiritilgan lavozim nomini solishtirish uchun. */
export function normalizePosition(value: string): string {
  return value.trim().toLowerCase().replace(/[''`]/g, "'");
}

export function isSubjectTeacherPosition(position: string): boolean {
  return normalizePosition(position) === SUBJECT_TEACHER_POSITION;
}

/** Bosh oshpaz lavozimi — unga tarbiyachi bo'limlari kerak emas. */
export const HEAD_CHEF_POSITION = "bosh oshpaz";

export function isHeadChefPosition(position: string): boolean {
  return normalizePosition(position) === HEAD_CHEF_POSITION;
}

/**
 * Kabineti bor, lekin guruhga biriktirilmaydigan lavozimlar: oshpaz oshxonada,
 * operator va administrator butun filial bilan ishlaydi. Eski bog'chalar
 * katalogida "Administrator" va "Operator", yangilarida "Call Operator".
 */
const GROUPLESS_POSITIONS = new Set(["bosh oshpaz", "call operator", "operator", "administrator"]);

export function isGrouplessPosition(position: string): boolean {
  return GROUPLESS_POSITIONS.has(normalizePosition(position));
}

/** Call operator — qo'ng'iroqlar va arizalar bilan ishlaydi, guruhga biriktirilmaydi. */
export const CALL_OPERATOR_POSITION = "call operator";

export function isCallOperatorPosition(position: string): boolean {
  const normalized = normalizePosition(position);
  // Eski katalogda shu lavozim "Operator" deb nomlangan
  return normalized === CALL_OPERATOR_POSITION || normalized === "operator";
}

/** Foydalanuvchi call operator lavozimidagi menejermi (yon panel/pastki panel tanlash uchun). */
export function isCallOperatorUser(user: { role: string; position?: string | null } | null | undefined): boolean {
  return user?.role === "MANAGER" && !!user.position && isCallOperatorPosition(user.position);
}

/** Tarbiyachi yordamchisi guruhni ko'radi, lekin davomat va xabar yozmaydi. */
export const ASSISTANT_POSITION = "tarbiyachi yordamchisi";

export function isAssistantPosition(position: string): boolean {
  return normalizePosition(position) === ASSISTANT_POSITION;
}

/**
 * Tizimga kirmaydigan lavozimlar: ularga kabinet (login/parol) ochilmaydi,
 * lekin xodimlar ro'yxatida turadi. "yuvuchi" — lavozim katalogidagi yozuv,
 * "yuvuvchi" — odatiy imlo; ikkalasi ham tanib olinadi. Kassir moliyaga
 * alohida moliyachi hisobi bilan kiradi — xodim kabineti orqali emas.
 */
const CABINETLESS_POSITIONS = new Set(["oshpaz yordamchisi", "idish yuvuchi", "idish yuvuvchi", "kassir"]);

export function isCabinetlessPosition(position: string): boolean {
  return CABINETLESS_POSITIONS.has(normalizePosition(position));
}

/** Oshpaz (bosh oshpaz, oshpaz yordamchisi va h.k.) guruhga biriktirilmaydi. */
export function isCookPosition(position: string): boolean {
  return normalizePosition(position).includes("oshpaz");
}

/**
 * Lavozim yorlig'ini hosil qiladi. "Fan o'qituvchisi" lavozimida tanlangan
 * fan(lar) ko'rsatiladi (masalan "Ingliz tili o'qituvchisi") — umumiy
 * "Fan o'qituvchisi" yozuvi o'rniga qaysi fandan ekani darhol ko'rinsin
 * degani. Boshqa lavozimlar o'zgarishsiz qaytadi.
 */
export function formatPositionLabel(position: string, subjects: string[] | null | undefined): string {
  if (!isSubjectTeacherPosition(position) || !subjects || subjects.length === 0) {
    return position;
  }
  return `${subjects.join(", ")} o'qituvchisi`;
}
