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

/**
 * Xodim hisobini boshqarish. Qoidalar API'dagi
 * `TenantUsersService.assertManageable` bilan bir xil:
 *   - o'z hisobiga tegib bo'lmaydi (buning uchun Sozlamalar bor);
 *   - Super Admin boshqa Super Adminga tegmaydi — aks holda tashkilot
 *     egasini bloklab, kirib bo'lmaydigan holatga tushib qolish mumkin;
 *   - filial admini faqat o'z filialidagi administrator va o'qituvchini.
 */
export function canManageUser(
  actor: { id: string; role: TenantUserRole; branchId: string | null } | null | undefined,
  target: { id: string; role: TenantUserRole; branchId: string | null },
): boolean {
  if (!actor || actor.id === target.id) return false;
  if (actor.role === "NETWORK_ADMIN") return target.role !== "NETWORK_ADMIN";
  if (actor.role === "BRANCH_ADMIN") {
    return (
      !!actor.branchId &&
      actor.branchId === target.branchId &&
      (target.role === "MANAGER" || target.role === "TEACHER")
    );
  }
  return false;
}

/**
 * Rolni almashtirish mumkinmi. O'qituvchining roli bu yerdan
 * o'zgartirilmaydi: uning logini xodim kartochkasi va guruh biriktiruviga
 * bog'langan, rolni almashtirish guruhlarni yetim qoldiradi.
 */
export function canChangeUserRole(
  actor: { role: TenantUserRole } | null | undefined,
  target: { role: TenantUserRole },
): boolean {
  return actor?.role === "NETWORK_ADMIN" && (target.role === "BRANCH_ADMIN" || target.role === "FINANCE");
}
