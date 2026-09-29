/**
 * Terminaldagi foydalanuvchi raqami (ISAPI `employeeNo`):
 * - xodim — `Employee.employeeNo` (1001, 1002, …);
 * - bola — "C" + bolaning ID raqami (`Child.publicId`): C14732.
 * Prefiks xodim va bola raqamlari hech qachon to'qnashmasligi uchun
 * (terminal harfli raqamni qabul qilishi DS-K1T342EX V4.39 da tekshirilgan).
 */
export const CHILD_PREFIX = "C";

export function childDeviceNo(publicId: number): string {
  return `${CHILD_PREFIX}${publicId}`;
}

/** "C14732" → 14732; bola raqami bo'lmasa `null`. */
export function parseChildDeviceNo(deviceNo: string): number | null {
  const match = /^C(\d{1,9})$/.exec(deviceNo);
  return match ? Number(match[1]) : null;
}
