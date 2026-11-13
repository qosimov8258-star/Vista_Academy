import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FEATURE_CATALOG, FEATURE_KEYS } from "../../common/features/feature-catalog";
import { PrismaService } from "../../database/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";

/**
 * Tarif funksiyalarini tekshiradi: faqat katalogdagi kalitlar, qiymat —
 * boolean (`allowNull` bo'lsa null ham — kalitni olib tashlash). Xato
 * bo'lsa jim tashlab yubormasdan 400 qaytaradi.
 */
function validateFeatures(features: unknown, allowNull: boolean): Record<string, boolean | null> {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    throw new BadRequestException("features obyekt bo'lishi kerak");
  }
  const out: Record<string, boolean | null> = {};
  for (const [key, value] of Object.entries(features as Record<string, unknown>)) {
    if (!FEATURE_KEYS.includes(key)) throw new BadRequestException(`Noma'lum funksiya: ${key}`);
    if (typeof value === "boolean" || (allowNull && value === null)) out[key] = value;
    else throw new BadRequestException(`"${key}" qiymati ${allowNull ? "true, false yoki null" : "true yoki false"} bo'lishi kerak`);
  }
  return out;
}

/** JSON ustundan faqat katalogdagi boolean kalitlar (eski/noma'lum kalitlar tozalanadi). */
function storedFeatures(value: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (FEATURE_KEYS.includes(key) && typeof v === "boolean") out[key] = v;
  }
  return out;
}

const labelOf = (key: string) => FEATURE_CATALOG.find((f) => f.key === key)?.label ?? key;

@Injectable()
export class PlansService {
  // Tarif tashkilotga bog'lanmagan, AuditLog esa bog'chaga yoziladi — shuning uchun server jurnaliga
  private readonly logger = new Logger("PlanAudit");

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto, actor?: AuthenticatedUser) {
    const features = dto.features !== undefined ? (validateFeatures(dto.features, false) as Record<string, boolean>) : {};
    const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException("Bu kod bilan reja allaqachon mavjud");
    }
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        code: dto.code,
        priceMonthly: new Prisma.Decimal(dto.priceMonthly),
        currency: dto.currency ?? "UZS",
        maxBranches: dto.maxBranches,
        maxChildren: dto.maxChildren,
        maxEmployees: dto.maxEmployees,
        maxStorageGb: dto.maxStorageGb,
        features,
      },
    });
    const off = Object.keys(features).filter((k) => features[k] === false);
    this.logger.log(`${actor?.fullName ?? "?"} (${actor?.id ?? "?"}) "${plan.code}" tarifini yaratdi; o'chiq funksiyalar: ${off.join(", ") || "yo'q"}`);
    return plan;
  }

  findAll() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException("Reja topilmadi");
    }
    return plan;
  }

  /**
   * `features` — merge: mavjud xaritaga qo'shiladi, `null` kalitni olib
   * tashlaydi. O'qish-yozish bir tranzaksiyada, tarif qatori qulflangan
   * holda — bir vaqtdagi tahrirlar bir-birini yo'qotmaydi.
   */
  async update(id: string, dto: UpdatePlanDto, actor?: AuthenticatedUser) {
    const { priceMonthly, features, ...rest } = dto;
    const patch = features !== undefined ? validateFeatures(features, true) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM plans WHERE id = ${id} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException("Reja topilmadi");

      let nextFeatures: Record<string, boolean> | undefined;
      const changes: string[] = [];
      if (patch) {
        const current = await tx.plan.findUniqueOrThrow({ where: { id }, select: { features: true } });
        nextFeatures = storedFeatures(current.features);
        for (const [key, value] of Object.entries(patch)) {
          const before = key in nextFeatures ? nextFeatures[key] : null;
          if (value === null) delete nextFeatures[key];
          else nextFeatures[key] = value;
          if (before !== value) changes.push(`${labelOf(key)}: ${value === null ? "odatiy" : value ? "yoqildi" : "o'chirildi"}`);
        }
      }

      const plan = await tx.plan.update({
        where: { id },
        data: {
          ...rest,
          ...(nextFeatures !== undefined ? { features: nextFeatures } : {}),
          ...(priceMonthly !== undefined ? { priceMonthly: new Prisma.Decimal(priceMonthly) } : {}),
        },
      });
      if (changes.length > 0) {
        this.logger.log(`${actor?.fullName ?? "?"} (${actor?.id ?? "?"}) "${plan.code}" tarif funksiyalarini o'zgartirdi: ${changes.join("; ")}`);
      }
      return plan;
    });
  }
}
