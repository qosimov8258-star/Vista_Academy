import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  FEATURE_PANELS,
  PANEL_KEYS,
  panelOverridesOf,
  parentsOf,
  resolveFeatures,
} from "../../common/features/feature-catalog";
import type { AuthenticatedUser } from "../auth/auth.types";

type PanelMap = Record<string, Record<string, boolean>>;

/** JSON ustundan faqat boolean qiymatli kalitlar. */
function booleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

const labelOf = (key: string) => FEATURE_CATALOG.find((f) => f.key === key)?.label ?? key;
const panelLabelOf = (panel: string) => FEATURE_PANELS.find((p) => p.key === panel)?.label ?? panel;
const valueWord = (v: boolean | null | undefined) => (v === true ? "yoqildi" : v === false ? "o'chirildi" : "odatiyga qaytarildi");

@Injectable()
export class OrganizationFeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  /** `parents` — asosiy bo'limlar ro'yxati; `parent` — eski mijozlar uchun birinchisi (yoki null). */
  catalog() {
    return FEATURE_CATALOG.map((feature) => {
      const parents = parentsOf(feature);
      return {
        key: feature.key,
        label: feature.label,
        group: feature.group,
        description: feature.description,
        parent: parents[0] ?? null,
        parents,
      };
    });
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
   * bo'yicha) holat. Tarif — yuqori chegara (resolveFeatures).
   *
   * `planRaw`/`orgRaw` — xom (ota-ona bo'yicha tarqatilmagan) qiymatlar: UI
   * saqlanmagan o'zgarishlar bilan birga to'g'ri hisoblashi uchun.
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
    const planRaw = booleanMap(plan?.features);
    const orgRaw = booleanMap(organization.featureOverrides);
    const panelOverrides = panel ? panelOverridesOf(organization.panelFeatureOverrides, panel) : {};
    return {
      panel: panel ?? null,
      planName: plan?.name ?? null,
      planRaw,
      orgRaw,
      planBlocked: FEATURE_KEYS.filter((key) => planRaw[key] === false),
      planFeatures: resolveFeatures(planRaw, {}),
      base: resolveFeatures(planRaw, orgRaw),
      overrides: panel ? panelOverrides : orgRaw,
      effective: resolveFeatures(planRaw, orgRaw, panelOverrides),
    };
  }

  /**
   * `null` qiymat — shu kalitning sozlamasini olib tashlaydi (bog'cha/tarifga qaytadi).
   * Tarifda o'chirilgan funksiyani yoqib bo'lmaydi. Bir vaqtdagi PATCH'lar
   * bir-birini yo'qotmasligi uchun bog'cha qatori `FOR UPDATE` bilan qulflanadi.
   */
  async setOverrides(
    organizationId: string,
    patch: Record<string, boolean | null>,
    panel: string | undefined,
    actor: AuthenticatedUser,
  ) {
    this.assertPanel(panel);
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new BadRequestException("overrides obyekt bo'lishi kerak");
    }
    for (const [key, value] of Object.entries(patch)) {
      if (!FEATURE_KEYS.includes(key)) throw new BadRequestException(`Noma'lum funksiya: ${key}`);
      if (value !== null && typeof value !== "boolean") {
        throw new BadRequestException(`"${key}" qiymati true, false yoki null bo'lishi kerak`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM organizations WHERE id = ${organizationId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException("Bog'cha topilmadi");
      const current = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: {
          featureOverrides: true,
          panelFeatureOverrides: true,
          subscription: { select: { plan: { select: { features: true } } } },
        },
      });

      // Tarif — yuqori chegara: tarifda yo'q funksiyani yoqish rad etiladi
      const planRaw = booleanMap(current.subscription?.plan?.features);
      const blocked = Object.entries(patch)
        .filter(([key, value]) => value === true && planRaw[key] === false)
        .map(([key]) => `«${labelOf(key)}»`);
      if (blocked.length > 0) {
        throw new BadRequestException(`${blocked.join(", ")} tarifda yo'q — avval tarifni o'zgartiring`);
      }

      const changes: string[] = [];
      const apply = (base: Record<string, boolean>) => {
        const next = { ...base };
        for (const [key, value] of Object.entries(patch)) {
          const before = key in next ? next[key] : null;
          if (value === null) delete next[key];
          else next[key] = value;
          if (before !== value) changes.push(`«${labelOf(key)}» ${valueWord(value)}`);
        }
        return next;
      };

      if (panel) {
        const all = { ...(current.panelFeatureOverrides as PanelMap) };
        const next = apply(panelOverridesOf(all, panel));
        if (Object.keys(next).length === 0) delete all[panel];
        else all[panel] = next;
        await tx.organization.update({
          where: { id: organizationId },
          data: { panelFeatureOverrides: all as Prisma.InputJsonObject },
        });
      } else {
        const next = apply(booleanMap(current.featureOverrides));
        await tx.organization.update({
          where: { id: organizationId },
          data: { featureOverrides: next as Prisma.InputJsonObject },
        });
      }

      // Audit: bog'cha jurnaliga platforma operatori nomidan (tenant foydalanuvchisi emas — actorUserId bo'sh)
      if (changes.length > 0) {
        const scope = panel ? `«${panelLabelOf(panel)}» paneli` : "butun bog'cha";
        await tx.auditLog.create({
          data: {
            organizationId,
            actorName: `Platforma: ${actor.fullName}`,
            action: "organization.features",
            entityType: "Organization",
            entityId: organizationId,
            summary: `Funksiyalar (${scope}): ${changes.join("; ")}`.slice(0, 2000),
          },
        });
      }
    });
    return this.get(organizationId, panel);
  }
}
