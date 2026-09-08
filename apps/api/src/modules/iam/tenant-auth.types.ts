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
  email: string;
  fullName: string;
  role: TenantUserRole;
}

export interface TenantAccessTokenPayload {
  sub: string;
  organizationId: string;
  /** Routing hints only — the backend re-derives everything from `sub` and never trusts these for authorization. */
  organizationSlug: string;
  branchSlug: string | null;
  branchId: string | null;
  email: string;
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
}

export function toTenantScope(user: TenantAuthenticatedUser): TenantScope {
  return { organizationId: user.organizationId, branchId: user.branchId, role: user.role };
}

/**
 * Requires a branch-level caller (BRANCH_ADMIN, FINANCE or MANAGER) and returns
 * their branch id. NETWORK_ADMIN ("Super Admin") is org-wide and observation-only,
 * so it is rejected here. This is the gate for the money modules — Moliya
 * (billing) and Ish haqi (HR) — which every branch-level role may write.
 */
export function requireBranchScope(scope: TenantScope): string {
  if (!scope.branchId) {
    throw new ForbiddenException("Bu amalni faqat filial darajasidagi foydalanuvchilar bajara oladi");
  }
  return scope.branchId;
}

/**
 * Gate for the operational modules — bolalar, guruhlar, xodimlar, davomat, CRM,
 * ovqatlanish, kundalik hisobot, bildirishnomalar. Same rule as
 * `requireBranchScope`, plus FINANCE ("Moliyachi") is read-only here: a
 * moliyachi writes in Moliya and Ish haqi only, and merely observes the rest.
 */
export function requireOperationalScope(scope: TenantScope): string {
  const branchId = requireBranchScope(scope);
  if (scope.role === "FINANCE") {
    throw new ForbiddenException("Moliyachi faqat Moliya va Ish haqi bo'limlarida o'zgartirish kirita oladi");
  }
  return branchId;
}
