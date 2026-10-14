import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  FEATURE_PANELS,
  PANEL_KEYS,
  panelOverridesOf,
  resolveFeatures,
} from "../../common/features/feature-catalog";

type PanelMap = Record<string, Record<string, boolean>>;

@Injectable()
export class OrganizationFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return FEATURE_CATALOG.map(({ key, label, group, description, parent }) => ({ key, label, group, description, parent: parent ?? null }));
  }

  panels() {
    return FEATURE_PANELS;
  }

  private assertPanel(panel: string | undefined) {
    if (panel !== undefined && !PANEL_KEYS.includes(panel)) {
      throw new BadRequestException(`Noma'lum panel: ${panel}`);
    }
  }

  /**
   * `panel` berilmasa — butun bog'cha. Berilsa — shu panel: `overrides` faqat
   * panelning o'z sozlamalari, `base` esa panel sozlamasisiz (bog'cha va tarif
   * bo'yicha) holat, ya'ni "Umumiy" tanlanganda shu qiymat amal qiladi.
   */
  async get(organizationId: string, panel?: string) {
    this.assertPanel(panel);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        featureOverrides: true,
        panelFeatureOverrides: true,
        subscription: { select: { plan: { select: { name: true, features: true } } } },
      },
    });
    if (!organization) throw new NotFoundException("Bog'cha topilmadi");
    const plan = organization.subscription?.plan ?? null;
    const orgOverrides = organization.featureOverrides as Record<string, boolean>;
    const panelOverrides = panel ? panelOverridesOf(organization.panelFeatureOverrides, panel) : {};
    return {
      panel: panel ?? null,
      planName: plan?.name ?? null,
      planFeatures: resolveFeatures(plan?.features, {}),
      base: resolveFeatures(plan?.features, orgOverrides),
      overrides: panel ? panelOverrides : orgOverrides,
      effective: resolveFeatures(plan?.features, orgOverrides, panelOverrides),
    };
  }

  /** `null` qiymat — shu kalitning sozlamasini olib tashlaydi (bog'cha/tarifga qaytadi). */
  async setOverrides(organizationId: string, patch: Record<string, boolean | null>, panel?: string) {
    this.assertPanel(panel);
    const current = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { featureOverrides: true, panelFeatureOverrides: true },
    });
    if (!current) throw new NotFoundException("Bog'cha topilmadi");

    const apply = (base: Record<string, boolean>) => {
      const next = { ...base };
      for (const [key, value] of Object.entries(patch)) {
        if (!FEATURE_KEYS.includes(key)) throw new BadRequestException(`Noma'lum funksiya: ${key}`);
        if (value === null) delete next[key];
        else if (typeof value === "boolean") next[key] = value;
        else throw new BadRequestException(`"${key}" qiymati true, false yoki null bo'lishi kerak`);
      }
      return next;
    };

    if (panel) {
      const all = { ...(current.panelFeatureOverrides as PanelMap) };
      const next = apply(panelOverridesOf(all, panel));
      if (Object.keys(next).length === 0) delete all[panel];
      else all[panel] = next;
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { panelFeatureOverrides: all as Prisma.InputJsonObject },
      });
    } else {
      const next = apply(current.featureOverrides as Record<string, boolean>);
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { featureOverrides: next as Prisma.InputJsonObject },
      });
    }
    return this.get(organizationId, panel);
  }
}
