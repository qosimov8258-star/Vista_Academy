import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";

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
        features: dto.features ?? {},
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
    const { priceMonthly, ...rest } = dto;
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...rest,
        ...(priceMonthly !== undefined ? { priceMonthly: new Prisma.Decimal(priceMonthly) } : {}),
      },
    });
  }
}
