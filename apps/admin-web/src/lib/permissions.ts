import type { TenantUserRole } from "./types";

/**
 * Bu yerdagi ikki tekshiruv API'dagi `requireBranchScope` va
 * `requireOperationalScope` bilan aynan bir xil qoidani takrorlaydi. UI faqat
 * tugmalarni yashiradi — haqiqiy cheklov serverda, shuning uchun ikkalasi
 * bir-biriga mos turishi kerak: biri o'zgarsa, ikkinchisi ham o'zgaradi.
 */

/** Rolga ko'ra ekranda ko'rinadigan nom. */
export const ROLE_LABEL: Record<TenantUserRole, string> = {
  NETWORK_ADMIN: "Super Admin",
  BRANCH_ADMIN: "Filial admini",
  FINANCE: "Moliyachi",
  MANAGER: "Administrator",
};

/**
 * Moliya va Ish haqi bo'limlarida yozish huquqi. Filialga biriktirilgan
 * barcha rollar (filial admini, moliyachi, administrator) yoza oladi;
 * Super Admin tashkilot bo'ylab faqat kuzatadi.
 */
export function canWriteMoney(role: TenantUserRole | undefined): boolean {
  return role !== undefined && role !== "NETWORK_ADMIN";
}

/**
 * Operatsion bo'limlarda (bolalar, guruhlar, xodimlar, davomat, CRM,
 * ovqatlanish, kundalik hisobot, bildirishnomalar) yozish huquqi.
 * Moliyachi bu yerda faqat ko'radi.
 */
export function canWriteOperational(role: TenantUserRole | undefined): boolean {
  return canWriteMoney(role) && role !== "FINANCE";
}

/** Foydalanuvchi yaratish huquqi: Super Admin va filial admini. */
export function canManageUsers(role: TenantUserRole | undefined): boolean {
  return role === "NETWORK_ADMIN" || role === "BRANCH_ADMIN";
}
