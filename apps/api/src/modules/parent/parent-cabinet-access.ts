import { disabledFeatureKeys } from "../../common/features/feature-catalog";

export const PARENT_CABINET_DISABLED_MESSAGE = "Bog'chada ota-ona kabineti hozircha yoqilmagan";

/** Bog'cha uchun ota-ona kabineti yoqilganmi (tarif → bog'cha → «Ota-onalar» paneli). */
export function isParentCabinetEnabled(organization: {
  featureOverrides: unknown;
  panelFeatureOverrides: unknown;
  subscription: { plan: { features: unknown } } | null;
}): boolean {
  return !disabledFeatureKeys(
    organization.subscription?.plan.features,
    organization.featureOverrides,
    "PARENT",
    organization.panelFeatureOverrides,
  ).includes("parentCabinet");
}
