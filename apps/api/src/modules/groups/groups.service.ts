import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds } from "../iam/teacher-scope";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { GroupQueryDto } from "./dto/group-query.dto";
import { GroupAttendanceQueryDto } from "./dto/group-attendance-query.dto";
import { GroupDayQueryDto } from "./dto/group-day-query.dto";

/**
 * Guruhning "band o'rinlari" har doim faqat FAOL bolalar bilan
 * hisoblanadi — nofaol/karantindagi bola sig'imni band qilmaydi.
 * `_count.children` shu filtr bilan qaytadi (masalan "12/15" ko'rinishida
 * ko'rsatilganda 12 — faqat faol bolalar soni).
 */
const ACTIVE_CHILDREN_COUNT_SELECT = { select: { children: { where: { status: "ACTIVE" as const } } } };

const DEFAULT_TIMEZONE = "Asia/Tashkent";
/** Sana oralig'i cheksiz bo'lib ketmasin — bir yildan uzunini so'ramaymiz. */
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 14;

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(caller: TenantAuthenticatedUser, dto: CreateGroupDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    let created;
    try {
      created = await this.prisma.group.create({
        data: { branchId, name: dto.name, capacity: dto.capacity },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan guruh allaqachon mavjud");
      }
      throw err;
    }
    await this.auditLog.logFromUser(caller, {
      action: "group.create",
      entityType: "Group",
      entityId: created.id,
      branchId,
      summary: `"${created.name}" guruhi yaratildi (sig'im ${created.capacity})`,
    });
    return created;
  }

  async findAll(scope: TenantScope, query: GroupQueryDto) {
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const where: Prisma.GroupWhereInput = {
      branch: { organizationId: scope.organizationId },
      branchId: scope.branchId ?? query.branchId,
      ...(teacherGroupIds === null ? {} : { id: { in: teacherGroupIds } }),
    };
    return this.prisma.group.findMany({
      where,
      include: {
        _count: ACTIVE_CHILDREN_COUNT_SELECT,
        // Guruh kartochkasida kim tarbiyachi ekani ko'rinib tursin
        teachers: { include: { employee: { select: { id: true, fullName: true, position: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(scope: TenantScope, id: string) {
    await this.assertAccess(scope, id);
    return this.prisma.group.findUniqueOrThrow({
      where: { id },
      include: { _count: ACTIVE_CHILDREN_COUNT_SELECT },
    });
  }

  async update(caller: TenantAuthenticatedUser, id: string, dto: UpdateGroupDto) {
    const scope = toTenantScope(caller);
    const group = await this.assertAccess(scope, id);
    if (dto.capacity !== undefined) {
      // Faqat faol bolalar joy band qiladi — nofaol/karantindagi bola
      // sig'imni kamaytirishga to'sqinlik qilmasligi kerak.
      const enrolled = await this.prisma.child.count({ where: { groupId: id, status: "ACTIVE" } });
      if (dto.capacity < enrolled) {
        throw new BadRequestException(
          `Sig'imni ${enrolled} dan kam qilib bo'lmaydi — guruhda hozir shuncha faol bola bor`,
        );
      }
    }
    let updated;
    try {
      updated = await this.prisma.group.update({
        where: { id },
        data: { name: dto.name, capacity: dto.capacity, status: dto.status },
        include: { _count: ACTIVE_CHILDREN_COUNT_SELECT },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu nom bilan guruh allaqachon mavjud");
      }
      throw err;
    }
    await this.auditLog.logFromUser(caller, {
      action: "group.update",
      entityType: "Group",
      entityId: id,
      branchId: group.branchId,
      summary: `"${updated.name}" guruhi tahrirlandi`,
    });
    return updated;
  }

  /**
   * Guruh kartochkasi: tarbiyachilari, bolalari va jinsi bo'yicha taqsimot.
   * Kirish huquqi `findOne` bilan bir xil tekshiriladi.
   */
  async overview(scope: TenantScope, id: string) {
    const group = await this.assertAccess(scope, id);

    const [branch, teacherLinks, children] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { id: group.branchId }, select: { id: true, name: true } }),
      this.prisma.groupTeacher.findMany({
        where: { groupId: id },
        include: { employee: { select: { id: true, fullName: true, position: true, isActive: true } } },
      }),
      this.prisma.child.findMany({
        where: { groupId: id },
        select: { id: true, publicId: true, fullName: true, gender: true, birthDate: true, status: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    const active = children.filter((child) => child.status === "ACTIVE");
    return {
      group: { id: group.id, name: group.name, capacity: group.capacity, status: group.status, createdAt: group.createdAt },
      branch,
      teachers: teacherLinks.map((link) => link.employee),
      children: {
        total: children.length,
        active: active.length,
        boys: active.filter((child) => child.gender === "MALE").length,
        girls: active.filter((child) => child.gender === "FEMALE").length,
        unknownGender: active.filter((child) => child.gender === null).length,
        items: children,
      },
    };
  }

  /**
   * Sana oralig'idagi davomat: har kun uchun nechta bola kelgani va har bir
   * bolaning shu oraliqdagi yig'indisi. Belgilanmagan kunlar alohida
   * ko'rsatiladi — ular "kelmadi" bilan bir xil emas.
   */
  async attendanceRange(scope: TenantScope, id: string, query: GroupAttendanceQueryDto) {
    await this.assertAccess(scope, id);

    const to = query.to ?? todayDateString();
    const from = query.from ?? dateKey(addDays(toDateOnly(to), -(DEFAULT_RANGE_DAYS - 1)));
    const fromDate = toDateOnly(from);
    const toDate = toDateOnly(to);
    if (fromDate > toDate) {
      throw new BadRequestException("Boshlanish sanasi tugash sanasidan keyin bo'lishi mumkin emas");
    }
    const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (dayCount > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Oraliq ${MAX_RANGE_DAYS} kundan uzun bo'lmasligi kerak`);
    }

    const children = await this.prisma.child.findMany({
      where: { groupId: id, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    const childIds = children.map((child) => child.id);

    const records = childIds.length
      ? await this.prisma.attendance.findMany({
          where: { childId: { in: childIds }, date: { gte: fromDate, lte: toDate } },
          select: { childId: true, date: true, status: true },
        })
      : [];

    const byDay = new Map<string, { present: number; absent: number }>();
    const byChild = new Map<string, { present: number; absent: number }>();
    for (const record of records) {
      const key = dateKey(record.date);
      const day = byDay.get(key) ?? { present: 0, absent: 0 };
      const child = byChild.get(record.childId) ?? { present: 0, absent: 0 };
      if (record.status === "PRESENT") {
        day.present += 1;
        child.present += 1;
      } else {
        day.absent += 1;
        child.absent += 1;
      }
      byDay.set(key, day);
      byChild.set(record.childId, child);
    }

    const days: { date: string; present: number; absent: number; unmarked: number }[] = [];
    for (let cursor = fromDate; cursor <= toDate; cursor = addDays(cursor, 1)) {
      const key = dateKey(cursor);
      const counts = byDay.get(key) ?? { present: 0, absent: 0 };
      days.push({
        date: key,
        present: counts.present,
        absent: counts.absent,
        unmarked: Math.max(0, children.length - counts.present - counts.absent),
      });
    }

    return {
      from,
      to,
      totalChildren: children.length,
      days,
      children: children.map((child) => {
        const counts = byChild.get(child.id) ?? { present: 0, absent: 0 };
        const marked = counts.present + counts.absent;
        return {
          childId: child.id,
          fullName: child.fullName,
          present: counts.present,
          absent: counts.absent,
          // Faqat belgilangan kunlar bo'yicha — belgilanmagan kun foizni pasaytirmaydi
          rate: marked === 0 ? null : Math.round((counts.present / marked) * 100),
        };
      }),
    };
  }

  /**
   * Bitta kunning nomli ro'yxati: kim keldi, kim kelmadi, kim belgilanmagan.
   * `attendanceRange` faqat sonlarni beradi — bu yerda ismlar kerak.
   */
  async attendanceDay(scope: TenantScope, id: string, query: GroupDayQueryDto) {
    await this.assertAccess(scope, id);
    const date = query.date ?? todayDateString();

    const children = await this.prisma.child.findMany({
      where: { groupId: id, status: "ACTIVE" },
      select: { id: true, publicId: true, fullName: true, gender: true },
      orderBy: { fullName: "asc" },
    });

    const records = children.length
      ? await this.prisma.attendance.findMany({
          where: { childId: { in: children.map((child) => child.id) }, date: toDateOnly(date) },
          select: { childId: true, status: true, note: true },
        })
      : [];
    const byChild = new Map(records.map((record) => [record.childId, record]));

    const items = children.map((child) => {
      const record = byChild.get(child.id);
      return {
        childId: child.id,
        publicId: child.publicId,
        fullName: child.fullName,
        gender: child.gender,
        // Yozuv yo'q bo'lsa "kelmadi" emas — hali belgilanmagan
        status: record?.status ?? null,
        note: record?.note ?? null,
      };
    });

    return {
      date,
      total: children.length,
      counts: {
        present: items.filter((item) => item.status === "PRESENT").length,
        absent: items.filter((item) => item.status === "ABSENT").length,
        unmarked: items.filter((item) => item.status === null).length,
      },
      items,
    };
  }

  /** Guruh shu tashkilot/filialga tegishlimi va o'qituvchiga biriktirilganmi. */
  private async assertAccess(scope: TenantScope, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, branch: { organizationId: scope.organizationId } },
    });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (scope.branchId && group.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu guruhga kirish huquqingiz yo'q");
    }
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroupIds !== null && !teacherGroupIds.includes(group.id)) {
      throw new ForbiddenException("Bu guruh sizga biriktirilmagan");
    }
    return group;
  }

  /** Bosh sahifadagi "guruh to'lganligi" vidjeti uchun — eng to'lganlaridan boshlab. */
  async capacityOverview(scope: TenantScope) {
    const branchId = scope.branchId;
    if (!branchId) {
      return { totalCapacity: 0, totalActive: 0, groups: [] };
    }
    const groups = await this.prisma.group.findMany({
      where: { branchId, status: "ACTIVE" },
      select: { id: true, name: true, capacity: true },
    });
    const counts = groups.length
      ? await this.prisma.child.groupBy({
          by: ["groupId"],
          where: { branchId, status: "ACTIVE", groupId: { in: groups.map((g) => g.id) } },
          _count: { _all: true },
        })
      : [];
    const countByGroup = new Map(counts.map((c) => [c.groupId, c._count._all]));
    const items = groups
      .map((g) => {
        const active = countByGroup.get(g.id) ?? 0;
        return {
          id: g.id,
          name: g.name,
          capacity: g.capacity,
          active,
          percent: g.capacity > 0 ? Math.round((active / g.capacity) * 100) : 0,
        };
      })
      .sort((a, b) => b.percent - a.percent);
    return {
      totalCapacity: groups.reduce((sum, g) => sum + g.capacity, 0),
      totalActive: items.reduce((sum, g) => sum + g.active, 0),
      groups: items,
    };
  }

  async countActive(scope: TenantScope) {
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    return this.prisma.group.count({
      where: {
        branch: { organizationId: scope.organizationId },
        branchId: scope.branchId ?? undefined,
        status: "ACTIVE",
        ...(teacherGroupIds === null ? {} : { id: { in: teacherGroupIds } }),
      },
    });
  }
}
