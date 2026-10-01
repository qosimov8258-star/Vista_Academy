import type { OrganizationStatus, SubscriptionStatus } from "@prisma/client";

/** Bog'cha to'xtatilgan bo'lsa xodim va ota-ona kirishida va har bir so'rovda shu xabar. */
export const ORGANIZATION_SUSPENDED_MESSAGE = "Bog'cha faoliyati to'xtatilgan — platforma administratoriga murojaat qiling";

/**
 * Platformada bog'cha (yoki uning obunasi) to'xtatilgan/bekor qilinganmi.
 * Ilgari "to'xtatish" faqat holatni o'zgartirardi — kirish va so'rovlar
 * tekshirmagani uchun bog'cha ishlashda davom etardi.
 * GRACE_PERIOD — imtiyozli davr, kirish ochiq qoladi.
 */
export function isOrganizationSuspended(
  organization: { status: OrganizationStatus },
  subscription: { status: SubscriptionStatus } | null | undefined,
): boolean {
  if (organization.status === "SUSPENDED") return true;
  return subscription?.status === "SUSPENDED" || subscription?.status === "CANCELLED";
}

/** Tashkilot bilan birga obuna holatini olish uchun Prisma include. */
export const ORGANIZATION_WITH_SUBSCRIPTION_STATUS = { subscription: { select: { status: true } } } as const;
