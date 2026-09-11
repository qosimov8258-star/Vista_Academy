/** Fan tanlovi talab qilinadigan yagona lavozim. */
export const SUBJECT_TEACHER_POSITION = "fan o'qituvchisi";

/** Turli tirnoq belgilari (', ', `) bilan kiritilgan lavozim nomini solishtirish uchun. */
export function normalizePosition(value: string): string {
  return value.trim().toLowerCase().replace(/[''`]/g, "'");
}

export function isSubjectTeacherPosition(position: string): boolean {
  return normalizePosition(position) === SUBJECT_TEACHER_POSITION;
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
