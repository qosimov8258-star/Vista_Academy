import { disabledFeatureKeys } from "./feature-catalog";

/**
 * HTTP so'rovidan tashqaridagi joylar (cron, Face ID qurilmasi, push
 * yuborish, boshqa funksiya ichidagi yon ta'sir) uchun: bog'chada qaysi
 * funksiyalar o'chiq. So'rov ichida esa `user.disabledFeatures` /
 * `parent.disabledFeatures` tayyor — qayta hisoblash shart emas.
 */

/** Prisma: tashkilotni funksiyalarni hisoblash uchun kerakli maydonlar bilan olish. */
export const ORGANIZATION_FEATURES_SELECT = {
  featureOverrides: true,
  panelFeatureOverrides: true,
  subscription: { select: { plan: { select: { features: true } } } },
} as const;

export interface OrganizationFeatureSource {
  featureOverrides: unknown;
  panelFeatureOverrides: unknown;
  subscription: { plan: { features: unknown } } | null;
}

/** Shu tashkilotda (berilsa — shu panelda: rol yoki "PARENT") o'chiq funksiyalar. */
export function disabledFeaturesOf(organization: OrganizationFeatureSource, panel?: string): string[] {
  return disabledFeatureKeys(
    organization.subscription?.plan.features,
    organization.featureOverrides,
    panel,
    organization.panelFeatureOverrides,
  );
}

/** Minimal Prisma ko'rinishi — servislar PrismaService yoki tranzaksiya mijozini bera oladi. */
interface OrganizationReader {
  organization: {
    findUnique(args: { where: { id: string }; select: typeof ORGANIZATION_FEATURES_SELECT }): Promise<OrganizationFeatureSource | null>;
  };
}

/** Tashkilot topilmasa — hammasi o'chiq deb hisoblanmaydi, bo'sh ro'yxat (chaqiruvchi o'zi tekshiradi). */
export async function loadDisabledFeatures(prisma: OrganizationReader, organizationId: string, panel?: string): Promise<string[]> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: ORGANIZATION_FEATURES_SELECT });
  return organization ? disabledFeaturesOf(organization, panel) : [];
}

/** Barcha berilgan funksiyalar yoqilganmi. */
export function allOn(disabled: readonly string[], ...features: string[]): boolean {
  return features.every((f) => !disabled.includes(f));
}

/**
 * Ota-onaga push/xabar yuborish mumkinmi: «Ota-onalar» panelida kabinet va
 * bildirishnomalar yoqilgan bo'lsin, qo'shimcha `features` (masalan
 * "attendance", "groupMaterials") ham.
 */
export async function canNotifyParents(prisma: OrganizationReader, organizationId: string, ...features: string[]): Promise<boolean> {
  const disabled = await loadDisabledFeatures(prisma, organizationId, "PARENT");
  return allOn(disabled, "parentCabinet", "notifications", ...features);
}
