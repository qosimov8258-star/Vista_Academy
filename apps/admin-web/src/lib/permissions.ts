import type { TenantUserRole } from "./types";

/**
 * Bu yerdagi tekshiruvlar API'dagi `requireMoneyScope`,
 * `requireOperationalScope` va `requireTeachingScope` bilan aynan bir xil
 * qoidani takrorlaydi. UI faqat tugmalarni yashiradi — haqiqiy cheklov
 * serverda, shuning uchun ikkalasi bir-biriga mos turishi kerak: biri
 * o'zgarsa, ikkinchisi ham o'zgaradi.
 */

/** Rolga ko'ra ekranda ko'rinadigan nom. */
export const ROLE_LABEL: Record<TenantUserRole, string> = {
  NETWORK_ADMIN: "Super Admin",
  BRANCH_ADMIN: "Filial admini",
  FINANCE: "Moliyachi",
  MANAGER: "Administrator",
  TEACHER: "O'qituvchi",
};

/** Filialga biriktirilgan har qanday rol (ya'ni Super Admin emas). */
function isBranchLevel(role: TenantUserRole | undefined): boolean {
  return role !== undefined && role !== "NETWORK_ADMIN";
}

/**
 * Moliya va Ish haqi bo'limlarida yozish huquqi. Filial admini, moliyachi
 * va administrator yozadi; Super Admin faqat kuzatadi, o'qituvchi esa bu
 * bo'limlarga umuman kirmaydi.
 */
export function canWriteMoney(role: TenantUserRole | undefined): boolean {
  return isBranchLevel(role) && role !== "TEACHER";
}

/**
 * Operatsion bo'limlarda (bolalar, guruhlar, xodimlar, CRM, ovqatlanish,
 * bildirishnomalar, xodimlar davomati) yozish huquqi.
 * Moliyachi va o'qituvchi bu yerda faqat ko'radi.
 */
export function canWriteOperational(role: TenantUserRole | undefined): boolean {
  return isBranchLevel(role) && role !== "FINANCE" && role !== "TEACHER";
}

/**
 * Tarbiyachilik ishi — bolalar davomati va kundalik hisobot.
 * O'qituvchi shu yerda ishlaydi (faqat o'z guruhlari doirasida), moliyachi yo'q.
 */
export function canWriteTeaching(role: TenantUserRole | undefined): boolean {
  return isBranchLevel(role) && role !== "FINANCE";
}

/** Foydalanuvchi yaratish huquqi: Super Admin va filial admini. */
export function canManageUsers(role: TenantUserRole | undefined): boolean {
  return role === "NETWORK_ADMIN" || role === "BRANCH_ADMIN";
}

/** O'qituvchi kabineti — yon panel va bosh sahifa u uchun boshqacha. */
export function isTeacher(role: TenantUserRole | undefined): boolean {
  return role === "TEACHER";
}
