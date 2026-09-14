import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { CoinsQueryDto } from "./dto/coins-query.dto";

/** Bola tafsilotidagi coin tarixida qaytariladigan yozuvlar soni chegarasi. */
const TRANSACTIONS_HISTORY_LIMIT = 200;

@Injectable()
export class CoinsService {
  constructor(private readonly prisma: PrismaService) {}

  async listChildBalances(scope: TenantScope, query: CoinsQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (scope.branchId && query.branchId && query.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);

    const children = await this.prisma.child.findMany({
      where: teacherChildWhere({ branchId, status: "ACTIVE" }, teacherGroupIds),
      select: {
        id: true,
        fullName: true,
        gender: true,
        avatarUpdatedAt: true,
        group: { select: { name: true } },
      },
      orderBy: [{ group: { name: "asc" } }, { fullName: "asc" }],
    });

    const childIds = children.map((c) => c.id);
    const [balances, sourceSums] = await Promise.all([
      childIds.length
        ? this.prisma.coinTransaction.groupBy({
            by: ["childId"],
            where: { childId: { in: childIds } },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      childIds.length
        ? this.prisma.coinTransaction.groupBy({
            by: ["childId", "source"],
            where: { childId: { in: childIds } },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);
    const balanceByChild = new Map(balances.map((b) => [b.childId, b._sum.amount ?? 0]));

    // Manba bo'yicha (davomat / haftalik baholash) jami — admin panelda
    // "qayerdan qancha coin kelgani" hisoboti uchun.
    const attendanceByChild = new Map<string, number>();
    const weeklyAssessmentByChild = new Map<string, number>();
    for (const row of sourceSums) {
      const amount = row._sum.amount ?? 0;
      if (row.source === "ATTENDANCE") {
        attendanceByChild.set(row.childId, amount);
      } else if (row.source === "WEEKLY_ASSESSMENT") {
        weeklyAssessmentByChild.set(row.childId, amount);
      }
    }

    return children.map((c) => ({
      childId: c.id,
      fullName: c.fullName,
      gender: c.gender,
      avatarUpdatedAt: c.avatarUpdatedAt,
      groupName: c.group?.name ?? null,
      balance: balanceByChild.get(c.id) ?? 0,
      attendanceCoins: attendanceByChild.get(c.id) ?? 0,
      weeklyAssessmentCoins: weeklyAssessmentByChild.get(c.id) ?? 0,
    }));
  }

  /** Bolaning to'liq coin tarixi — oxirgi 200 tasi, eng yangisi birinchi. View-only. */
  async listTransactions(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }

    return this.prisma.coinTransaction.findMany({
      where: { childId: child.id },
      orderBy: { createdAt: "desc" },
      take: TRANSACTIONS_HISTORY_LIMIT,
      select: { id: true, amount: true, reason: true, source: true, createdAt: true },
    });
  }
}
