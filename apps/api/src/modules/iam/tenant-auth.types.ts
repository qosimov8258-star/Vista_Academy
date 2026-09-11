import { ForbiddenException } from "@nestjs/common";
import { TenantUserRole } from "@prisma/client";

export interface TenantAuthenticatedUser {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  branchId: string | null;
  branchSlug: string | null;
  branchName: string | null;
  login: string;
  fullName: string;
  role: TenantUserRole;
  /** Profil rasmi bor-yo'qligi va brauzer keshini yangilash uchun. */
  avatarUpdatedAt: string | null;
  /** Bog'langan xodim kartochkasidagi lavozim (masalan "Fan o'qituvchisi", "Oshpaz"). Xodimga bog'lanmagan hisoblarda (Super Admin, moliyachi) — null. */
  position: string | null;
  /** "Fan o'qituvchisi" lavozimida tanlangan fan(lar). Boshqa lavozimlarda/bog'lanmagan hisoblarda — bo'sh massiv. */
  subjects: string[];
}

export interface TenantAccessTokenPayload {
  sub: string;
  organizationId: string;
  /** Routing hints only — the backend re-derives everything from `sub` and never trusts these for authorization. */
  organizationSlug: string;
  branchSlug: string | null;
  branchId: string | null;
  login: string;
  role: TenantUserRole;
}

/**
 * Data-access scope derived from the authenticated tenant user: organization-wide
 * for NETWORK_ADMIN (branchId null), single-branch for the branch-level roles.
 * Pass this into services instead of a raw organizationId so branch scoping
 * can't be bypassed by a caller-supplied branchId in the request body/query.
 * `role` travels with the scope because write permission now depends on which
 * branch-level role the caller holds, not only on having a branch at all.
 */
export interface TenantScope {
  organizationId: string;
  branchId: string | null;
  role: TenantUserRole;
  /** O'qituvchining guruhlarini aniqlash uchun kerak (`resolveTeacherGroupIds`). */
  userId: string;
}

export function toTenantScope(user: TenantAuthenticatedUser): TenantScope {
  return {
    organizationId: user.organizationId,
    branchId: user.branchId,
    role: user.role,
    userId: user.id,
  };
}

/**
 * Asosiy shart: chaqiruvchi filialga biriktirilgan bo'lishi kerak.
 * NETWORK_ADMIN ("Super Admin") tashkilot bo'ylab faqat kuzatadi, shuning
 * uchun bu yerda rad etiladi. To'g'ridan-to'g'ri emas, quyidagi uchta
 * darvoza orqali ishlatiladi.
 */
export function requireBranchScope(scope: TenantScope): string {
  if (!scope.branchId) {
    throw new ForbiddenException("Bu amalni faqat filial darajasidagi foydalanuvchilar bajara oladi");
  }
  return scope.branchId;
}

/**
 * Pul modullari — Moliya (billing) va Ish haqi (HR).
 * Filial admini, moliyachi va administrator yozadi; o'qituvchi bu yerga
 * umuman kirmaydi.
 */
export function requireMoneyScope(scope: TenantScope): string {
  const branchId = requireBranchScope(scope);
  if (scope.role === "TEACHER") {
    throw new ForbiddenException("O'qituvchi moliya bo'limlarida ishlay olmaydi");
  }
  return branchId;
}

/**
 * Operatsion modullar — bolalar, guruhlar, xodimlar, CRM, ovqatlanish,
 * bildirishnomalar, xodimlar davomati. Filial admini va administrator
 * yozadi; moliyachi va o'qituvchi faqat kuzatadi.
 */
export function requireOperationalScope(scope: TenantScope): string {
  const branchId = requireBranchScope(scope);
  if (scope.role === "FINANCE") {
    throw new ForbiddenException("Moliyachi faqat Moliya va Ish haqi bo'limlarida o'zgartirish kirita oladi");
  }
  if (scope.role === "TEACHER") {
    throw new ForbiddenException("O'qituvchi faqat o'z guruhlarining davomati va kundalik hisobotini yuritadi");
  }
  return branchId;
}

/**
 * Tarbiyachilik ishi — bolalar davomati va kundalik hisobot.
 * O'qituvchi shu yerda ishlaydi (lekin faqat o'z guruhlari doirasida —
 * buni `assertTeacherOwnsChild` tekshiradi), moliyachi esa yo'q.
 */
export function requireTeachingScope(scope: TenantScope): string {
  const branchId = requireBranchScope(scope);
  if (scope.role === "FINANCE") {
    throw new ForbiddenException("Moliyachi faqat Moliya va Ish haqi bo'limlarida o'zgartirish kirita oladi");
  }
  return branchId;
}
