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
 * for NETWORK_ADMIN (branchId null), single-branch for BRANCH_ADMIN/MANAGER.
 * Pass this into services instead of a raw organizationId so branch scoping
 * can't be bypassed by a caller-supplied branchId in the request body/query.
 */
export interface TenantScope {
  organizationId: string;
  branchId: string | null;
}

export function toTenantScope(user: TenantAuthenticatedUser): TenantScope {
  return { organizationId: user.organizationId, branchId: user.branchId };
}

/**
 * NETWORK_ADMIN (org-wide, branchId null) is observation-only across every
 * write endpoint in the operational modules — day-to-day data entry belongs
 * to the branch-level roles (BRANCH_ADMIN / MANAGER). Call this at the top of
 * any create/mark/update method; it returns the caller's branch id or throws.
 */
export function requireBranchScope(scope: TenantScope): string {
  if (!scope.branchId) {
    throw new ForbiddenException("Bu amalni faqat filial darajasidagi foydalanuvchilar bajara oladi");
  }
  return scope.branchId;
}
