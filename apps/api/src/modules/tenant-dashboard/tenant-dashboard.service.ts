import { Injectable } from "@nestjs/common";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { ChildrenService } from "../children/children.service";
import { GroupsService } from "../groups/groups.service";
import { EmployeesService } from "../employees/employees.service";
import { AttendanceService } from "../attendance/attendance.service";
import { StaffAttendanceService } from "../staff-attendance/staff-attendance.service";
import { DailyReportsService } from "../daily-reports/daily-reports.service";
import { BillingService } from "../billing/billing.service";
import { CrmService } from "../crm/crm.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly childrenService: ChildrenService,
    private readonly groupsService: GroupsService,
    private readonly employeesService: EmployeesService,
    private readonly attendanceService: AttendanceService,
    private readonly staffAttendanceService: StaffAttendanceService,
    private readonly dailyReportsService: DailyReportsService,
    private readonly billingService: BillingService,
    private readonly crmService: CrmService,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async summary(scope: TenantScope) {
    // Bildirishnomalar sahifasida ko'rinishidan oldin, hozirgi holatga mos
    // ravishda yetishmayotganlarini to'ldirib qo'yamiz.
    await this.billingService.syncOverdueNotifications(scope);

    // Filial darajasidagi vidjetlar (diqqat, tug'ilgan kun, guruh
    // to'lganligi, qarzdorlar) faqat bitta filialga biriktirilgan
    // foydalanuvchilar uchun ma'noli — Super Adminning tarmoq bo'ylab
    // ko'rinishida bo'sh qaytariladi (xuddi "Filial raqamlari" bo'limi
    // yashirilganidek).
    const [
      childrenCount,
      activeGroupsCount,
      employeesCount,
      monthRevenue,
      previousMonthRevenue,
      outstandingDebt,
      overdueInvoicesCount,
      todayAttendance,
      todayStaffAttendance,
      todayDailyReportsFilled,
      activeLeadsCount,
      pendingNotificationsCount,
      attention,
      upcomingBirthdays,
      groupCapacity,
      topDebtors,
    ] = await Promise.all([
      this.childrenService.countActive(scope),
      this.groupsService.countActive(scope),
      this.employeesService.countActive(scope),
      this.billingService.monthRevenue(scope),
      this.billingService.previousMonthRevenue(scope),
      this.billingService.outstandingDebt(scope),
      this.billingService.overdueInvoicesCount(scope),
      this.attendanceService.todaySummary(scope),
      this.staffAttendanceService.todaySummary(scope),
      this.dailyReportsService.todayFilledCount(scope),
      this.crmService.countActive(scope),
      this.notificationsService.countPending(scope),
      scope.branchId
        ? this.attentionList(scope)
        : Promise.resolve({ unmarkedAttendance: [], missingDailyReport: [], overdueVaccinations: [] }),
      scope.branchId ? this.upcomingBirthdays(scope) : Promise.resolve([]),
      scope.branchId
        ? this.groupsService.capacityOverview(scope)
        : Promise.resolve({ totalCapacity: 0, totalActive: 0, groups: [] }),
      scope.branchId ? this.billingService.topDebtors(scope) : Promise.resolve([]),
    ]);

    return {
      childrenCount,
      activeGroupsCount,
      employeesCount,
      monthRevenue,
      previousMonthRevenue,
      outstandingDebt,
      overdueInvoicesCount,
      todayAttendance,
      todayStaffAttendance,
      todayDailyReportsFilled,
      activeLeadsCount,
      pendingNotificationsCount,
      attention,
      upcomingBirthdays,
      groupCapacity,
      topDebtors,
    };
  }

  /** Bugun kimning davomati belgilanmagan, kundalik hisoboti to'ldirilmagan
   * va kimning rejalashtirilgan vaksinatsiyasi muddati o'tib ketgan. */
  private async attentionList(scope: TenantScope) {
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const [attendanceDay, reportDay, overdueVaccinations] = await Promise.all([
      this.attendanceService.findByBranchAndDate(scope, {}),
      this.dailyReportsService.findByBranchAndDate(scope, {}),
      this.prisma.vaccination.findMany({
        where: {
          branchId: scope.branchId ?? undefined,
          status: "SCHEDULED",
          scheduledDate: { lt: new Date() },
          child: teacherChildWhere({ status: "ACTIVE" }, teacherGroupIds),
        },
        select: { id: true, childId: true, name: true, scheduledDate: true, child: { select: { fullName: true } } },
        orderBy: { scheduledDate: "asc" },
      }),
    ]);
    return {
      unmarkedAttendance: attendanceDay.children
        .filter((c) => c.status === null)
        .map((c) => ({ childId: c.childId, fullName: c.fullName, groupName: c.groupName })),
      missingDailyReport: reportDay.children
        .filter((c) => c.report === null)
        .map((c) => ({ childId: c.childId, fullName: c.fullName, groupName: c.groupName })),
      overdueVaccinations: overdueVaccinations.map((v) => ({
        childId: v.childId,
        fullName: v.child.fullName,
        vaccineName: v.name,
        scheduledDate: v.scheduledDate,
      })),
    };
  }

  /** Kelasi 7 kun ichida tug'ilgan kuni bo'lgan bolalar. */
  private async upcomingBirthdays(scope: TenantScope, days = 7) {
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const children = await this.prisma.child.findMany({
      where: teacherChildWhere({ branchId: scope.branchId ?? undefined, status: "ACTIVE" }, teacherGroupIds),
      select: { id: true, fullName: true, birthDate: true },
    });
    const today = new Date();
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return children
      .filter((c): c is typeof c & { birthDate: Date } => c.birthDate !== null)
      .map((c) => {
        const month = c.birthDate.getUTCMonth();
        const day = c.birthDate.getUTCDate();
        let occurrence = birthdayOccurrenceUTC(today.getUTCFullYear(), month, day);
        if (occurrence < todayUTC) {
          occurrence = birthdayOccurrenceUTC(today.getUTCFullYear() + 1, month, day);
        }
        const daysUntil = Math.round((occurrence - todayUTC) / 86_400_000);
        return { childId: c.id, fullName: c.fullName, birthDate: c.birthDate, daysUntil };
      })
      .filter((c) => c.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }

  /**
   * Bitta filial haqidagi to'liq ma'lumot: bolalar (jinsi va holati bo'yicha),
   * guruhlar to'ldirilishi, xodimlar va to'lovlar holati.
   *
   * `summary()` dan farqi — bu sahifa bir filialni chuqurroq ko'rsatadi,
   * shuning uchun raqamlar bo'linmalarga ajratilgan holda qaytadi.
   */
  async branchReport(scope: TenantScope, branchId: string) {
    // Hisobotda butun filialning moliyasi bor, shuning uchun uni faqat
    // filialni boshqaradiganlar ko'radi. O'qituvchi o'z filialida bo'lsa ham
    // bu sahifaga kira olmaydi — u faqat o'z guruhlarini yuritadi.
    if (scope.role !== "NETWORK_ADMIN" && scope.role !== "BRANCH_ADMIN") {
      throw new ForbiddenException("Bu hisobotni faqat Super Admin va filial admini ko'ra oladi");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: scope.organizationId },
    });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    // Filialga biriktirilgan foydalanuvchi faqat o'z filialini so'ray oladi
    if (scope.branchId && scope.branchId !== branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }

    const [childGenders, childStatuses, groups, employees, invoices, monthRevenue, outstandingDebt] =
      await Promise.all([
        this.prisma.child.groupBy({
          by: ["gender"],
          where: { branchId, status: "ACTIVE" },
          _count: { _all: true },
        }),
        this.prisma.child.groupBy({
          by: ["status"],
          where: { branchId },
          _count: { _all: true },
        }),
        this.prisma.group.findMany({
          where: { branchId },
          select: {
            id: true,
            name: true,
            capacity: true,
            status: true,
            // Faqat faol bolalar guruh o'rnini band qiladi.
            _count: { select: { children: { where: { status: "ACTIVE" } } } },
            teachers: { select: { employee: { select: { id: true, fullName: true } } } },
          },
          orderBy: { name: "asc" },
        }),
        this.prisma.employee.findMany({
          where: { branchId },
          select: { id: true, position: true, isActive: true, tenantUserId: true },
        }),
        this.prisma.invoice.groupBy({
          by: ["status"],
          where: { branchId },
          _count: { _all: true },
          _sum: { amount: true, discountAmount: true, paidAmount: true },
        }),
        this.billingService.monthRevenue({ ...scope, branchId }),
        this.billingService.outstandingDebt({ ...scope, branchId }),
      ]);

    const genderCount = (value: "MALE" | "FEMALE" | null) =>
      childGenders.find((row) => row.gender === value)?._count._all ?? 0;
    const statusCount = (value: "ACTIVE" | "INACTIVE" | "QUARANTINED") =>
      childStatuses.find((row) => row.status === value)?._count._all ?? 0;

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        timezone: branch.timezone,
        currency: branch.currency,
        createdAt: branch.createdAt,
      },
      children: {
        active: childGenders.reduce((sum, row) => sum + row._count._all, 0),
        boys: genderCount("MALE"),
        girls: genderCount("FEMALE"),
        // Migratsiyadan oldin qo'shilgan bolalarda jins ko'rsatilmagan
        unknownGender: genderCount(null),
        quarantined: statusCount("QUARANTINED"),
        inactive: statusCount("INACTIVE"),
      },
      groups: {
        total: groups.length,
        active: groups.filter((group) => group.status === "ACTIVE").length,
        capacity: groups.reduce((sum, group) => sum + group.capacity, 0),
        items: groups.map((group) => ({
          id: group.id,
          name: group.name,
          capacity: group.capacity,
          status: group.status,
          childrenCount: group._count.children,
          teachers: group.teachers.map((link) => link.employee.fullName),
        })),
      },
      employees: {
        total: employees.length,
        active: employees.filter((employee) => employee.isActive).length,
        // Kabineti bor xodim tizimga kira oladi
        withAccount: employees.filter((employee) => employee.tenantUserId).length,
        byPosition: Object.entries(
          employees.reduce<Record<string, number>>((acc, employee) => {
            acc[employee.position] = (acc[employee.position] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([position, count]) => ({ position, count })),
      },
      finance: {
        monthRevenue,
        outstandingDebt,
        invoices: invoices.map((row) => ({
          status: row.status,
          count: row._count._all,
          // Hisob-fakturaning to'lanishi kerak bo'lgan summasi: chegirma ayiriladi
          billed: Number(row._sum.amount ?? 0) - Number(row._sum.discountAmount ?? 0),
          paid: Number(row._sum.paidAmount ?? 0),
        })),
      },
    };
  }
}

/**
 * Berilgan yilda tug'ilgan kunning UTC sanasi. 29-fevral kabisa bo'lmagan
 * yilga to'g'ri kelsa, `Date.UTC` uni avtomatik 1-martga aylantirib
 * yuboradi — shuning uchun bunday holda 28-fevralga tushiramiz.
 */
function birthdayOccurrenceUTC(year: number, month: number, day: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const safeDay = month === 1 && day === 29 && !isLeap ? 28 : day;
  return Date.UTC(year, month, safeDay);
}
