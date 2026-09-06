import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireBranchScope } from "../iam/tenant-auth.types";
import { UpsertMenuEntryDto } from "./dto/upsert-menu-entry.dto";
import { MenuQueryDto } from "./dto/menu-query.dto";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(scope: TenantScope, dto: UpsertMenuEntryDto) {
    const branchId = requireBranchScope(scope);
    const date = toDateOnly(dto.date);
    return this.prisma.menuEntry.upsert({
      where: { branchId_date: { branchId, date } },
      create: { branchId, date, breakfast: dto.breakfast, lunch: dto.lunch, snack: dto.snack },
      update: { breakfast: dto.breakfast, lunch: dto.lunch, snack: dto.snack },
    });
  }

  async findRange(scope: TenantScope, query: MenuQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return this.prisma.menuEntry.findMany({
      where: { branchId, date: { gte: toDateOnly(query.from), lte: toDateOnly(query.to) } },
      orderBy: { date: "asc" },
    });
  }
}
