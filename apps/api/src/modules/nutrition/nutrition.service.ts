import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { requireKitchenWriteScope } from "./kitchen-scope";
import { UpsertMenuEntryDto } from "./dto/upsert-menu-entry.dto";
import { MenuQueryDto } from "./dto/menu-query.dto";

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class NutritionService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(scope: TenantScope, dto: UpsertMenuEntryDto) {
    const branchId = await requireKitchenWriteScope(this.prisma, scope);
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

  /**
   * Bugungi ovqat uchun bolalar soni: tarbiyachilar belgilagan davomatdan olinadi.
   * Ovqat "keldi" va "kechikdi" bolalarga tayyorlanadi; hali davomat qilinmagan
   * guruhlar alohida ko'rsatiladi — oshpaz raqam hali to'liq emasligini bilsin.
   */
  async todaySummary(scope: TenantScope, query: { branchId?: string; date: string }) {
    const branchId = scope.branchId ?? query.branchId;
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "")) {
      throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
    }
    const date = toDateOnly(query.date);
    const [groups, children, attendances] = await Promise.all([
      this.prisma.group.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.child.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, groupId: true } }),
      this.prisma.attendance.findMany({ where: { branchId, date }, select: { childId: true, status: true } }),
    ]);
    const statusByChild = new Map(attendances.map((a) => [a.childId, a.status]));
    const rows = groups.map((g) => ({ groupId: g.id as string | null, name: g.name, total: 0, present: 0, late: 0, absent: 0, sick: 0, notMarked: 0 }));
    const noGroup = { groupId: null as string | null, name: "Guruhsiz", total: 0, present: 0, late: 0, absent: 0, sick: 0, notMarked: 0 };
    const byId = new Map(rows.map((r) => [r.groupId, r]));
    for (const child of children) {
      const row = (child.groupId && byId.get(child.groupId)) || noGroup;
      row.total += 1;
      const status = statusByChild.get(child.id);
      if (status === "PRESENT") row.present += 1;
      else if (status === "LATE") row.late += 1;
      else if (status === "ABSENT") row.absent += 1;
      else if (status === "SICK") row.sick += 1;
      else row.notMarked += 1;
    }
    if (noGroup.total > 0) rows.push(noGroup);
    const sum = (key: "total" | "present" | "late" | "absent" | "sick" | "notMarked") => rows.reduce((acc, r) => acc + r[key], 0);
    return {
      date: query.date,
      total: sum("total"),
      present: sum("present"),
      late: sum("late"),
      absent: sum("absent"),
      sick: sum("sick"),
      notMarked: sum("notMarked"),
      // Ovqat tayyorlanadigan bolalar: kelganlar va kechikkanlar.
      mealCount: sum("present") + sum("late"),
      groups: rows,
    };
  }
}
