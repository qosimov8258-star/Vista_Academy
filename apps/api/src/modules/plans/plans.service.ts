import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FEATURE_KEYS } from "../../common/features/feature-catalog";
import { PrismaService } from "../../database/prisma.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";

/** Faqat katalogdagi kalitlar va boolean qiymatlar saqlanadi. */
function sanitizeFeatures(features: Record<string, boolean> | undefined): Record<string, boolean> | undefined {
  if (!features) return undefined;
  const out: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    if (typeof features[key] === "boolean") out[key] = features[key];
  }
  return out;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException("Bu kod bilan reja allaqachon mavjud");
    }
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        code: dto.code,
        priceMonthly: new Prisma.Decimal(dto.priceMonthly),
        currency: dto.currency ?? "UZS",
        maxBranches: dto.maxBranches,
        maxChildren: dto.maxChildren,
        maxEmployees: dto.maxEmployees,
        maxStorageGb: dto.maxStorageGb,
        features: sanitizeFeatures(dto.features) ?? {},
      },
    });
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

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id);
    const { priceMonthly, features, ...rest } = dto;
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...rest,
        ...(features !== undefined ? { features: sanitizeFeatures(features) } : {}),
        ...(priceMonthly !== undefined ? { priceMonthly: new Prisma.Decimal(priceMonthly) } : {}),
      },
    });
  }
}
