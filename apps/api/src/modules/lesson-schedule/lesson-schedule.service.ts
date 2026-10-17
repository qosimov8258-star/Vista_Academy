import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Weekday } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds } from "../iam/teacher-scope";
import { CheckLessonScheduleDto, CreateLessonScheduleDto } from "./dto/create-lesson-schedule.dto";
import { UpdateLessonScheduleDto } from "./dto/update-lesson-schedule.dto";
import { LessonScheduleQueryDto } from "./dto/lesson-schedule-query.dto";
import { WEEKDAY_LABEL, blocking, findScheduleConflicts, timeToMinutes, type PlannedSlot, type ScheduleConflict } from "./schedule-conflicts";

const scheduleInclude = {
  group: { select: { id: true, name: true } },
  employee: { select: { id: true, fullName: true } },
  room: { select: { id: true, name: true } },
} satisfies Prisma.LessonScheduleInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class LessonScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ko'rish: admin/administrator butun filialni (guruh, xona yoki o'qituvchi
   * bo'yicha filtrlab) ko'radi. O'qituvchi — o'z guruhlaridagi darslarni va
   * o'zi o'tadigan darslarni (fan o'qituvchisi guruhga biriktirilmagan bo'lsa
   * ham o'z jadvalini ko'rsin).
   */
  async findAll(scope: TenantScope, query: LessonScheduleQueryDto) {
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

    const where: Prisma.LessonScheduleWhereInput = {
      branchId,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (teacherGroupIds !== null) {
      const self = await this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId }, select: { id: true } });
      where.OR = [{ groupId: { in: teacherGroupIds } }, ...(self ? [{ employeeId: self.id }] : [])];
    }

    return this.prisma.lessonSchedule.findMany({
      where,
      include: scheduleInclude,
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  }

  /** Saqlashdan oldin: forma ma'lumoti bilan qaysi darslar to'qnashadi (yozmaydi). */
  async check(scope: TenantScope, dto: CheckLessonScheduleDto) {
    const branchId = requireOperationalScope(scope);
    assertTimeRange(dto.startTime, dto.endTime);
    await this.assertBelongsToBranch(this.prisma, branchId, dto.groupId, dto.employeeId, dto.roomId ?? null);
    const conflicts = await this.conflictsFor(this.prisma, branchId, {
      groupId: dto.groupId,
      employeeId: dto.employeeId,
      roomId: dto.roomId ?? null,
      weekdays: dto.weekdays,
      startTime: dto.startTime,
      endTime: dto.endTime,
    }, dto.scheduleId ? [dto.scheduleId] : []);
    return { conflicts, blocking: blocking(conflicts).length > 0 };
  }

  /** Yozish — faqat filial admini va administrator. */
  async create(scope: TenantScope, dto: CreateLessonScheduleDto) {
    const branchId = requireOperationalScope(scope);
    assertTimeRange(dto.startTime, dto.endTime);
    const planned: PlannedSlot = {
      groupId: dto.groupId,
      employeeId: dto.employeeId,
      roomId: dto.roomId ?? null,
      weekdays: dto.weekdays,
      startTime: dto.startTime,
      endTime: dto.endTime,
    };

    const created = await this.prisma.$transaction(async (tx) => {
      await lockBranchSchedule(tx, branchId);
      await this.assertBelongsToBranch(tx, branchId, planned.groupId, planned.employeeId, planned.roomId);
      // Hamma kunlar oldindan tekshiriladi — to'qnashuv bo'lsa (va «Baribir saqlash» bosilmagan bo'lsa) hech biri yaratilmaydi.
      assertNoBlockingConflicts(await this.conflictsFor(tx, branchId, planned, []), dto.force);
      const rows = [];
      for (const weekday of dto.weekdays) {
        rows.push(
          await tx.lessonSchedule.create({
            data: { branchId, groupId: dto.groupId, employeeId: dto.employeeId, roomId: planned.roomId, subject: dto.subject, weekday, startTime: dto.startTime, endTime: dto.endTime },
            include: scheduleInclude,
          }),
        );
      }
      return rows;
    });
    // Bir nechta kun tanlangan bo'lsa ham o'qituvchiga bitta xabar boradi.
    await this.notifyEmployee(created[0], created.map((row) => row.weekday));
    return created;
  }

  /**
   * Tahrirlash. `weekdays` berilsa — shu dars birinchi kunga o'tadi, qolgan
   * kunlarga nusxa yaratiladi; hammasi bitta tranzaksiyada (yarmi saqlanib
   * qolmaydi). Javob — saqlangan barcha darslar.
   */
  async update(scope: TenantScope, id: string, dto: UpdateLessonScheduleDto) {
    const branchId = requireOperationalScope(scope);
    const existing = await this.prisma.lessonSchedule.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException("Dars jadvali topilmadi");
    }

    const weekdays = dto.weekdays ?? [dto.weekday ?? existing.weekday];
    const planned: PlannedSlot = {
      groupId: dto.groupId ?? existing.groupId,
      employeeId: dto.employeeId ?? existing.employeeId,
      roomId: dto.roomId === undefined ? existing.roomId : dto.roomId,
      weekdays,
      startTime: dto.startTime ?? existing.startTime,
      endTime: dto.endTime ?? existing.endTime,
    };
    assertTimeRange(planned.startTime, planned.endTime);

    const saved = await this.prisma.$transaction(async (tx) => {
      await lockBranchSchedule(tx, branchId);
      await this.assertBelongsToBranch(tx, branchId, planned.groupId, planned.employeeId, planned.roomId);
      assertNoBlockingConflicts(await this.conflictsFor(tx, branchId, planned, [id]), dto.force);
      const data = {
        groupId: planned.groupId,
        employeeId: planned.employeeId,
        roomId: planned.roomId,
        subject: dto.subject === undefined ? existing.subject : dto.subject,
        startTime: planned.startTime,
        endTime: planned.endTime,
      };
      const rows = [await tx.lessonSchedule.update({ where: { id }, data: { ...data, weekday: weekdays[0] }, include: scheduleInclude })];
      for (const weekday of weekdays.slice(1)) {
        rows.push(await tx.lessonSchedule.create({ data: { ...data, branchId, weekday }, include: scheduleInclude }));
      }
      return rows;
    });

    // Xodim, guruh, xona, kun yoki vaqt o'zgarsa — o'qituvchi qayta xabardor qilinadi.
    const changed =
      planned.groupId !== existing.groupId ||
      planned.employeeId !== existing.employeeId ||
      planned.roomId !== existing.roomId ||
      planned.startTime !== existing.startTime ||
      planned.endTime !== existing.endTime ||
      weekdays.length !== 1 ||
      weekdays[0] !== existing.weekday;
    if (changed) {
      await this.notifyEmployee(saved[0], saved.map((row) => row.weekday));
    }
    return dto.weekdays ? saved : saved[0];
  }

  async remove(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const existing = await this.prisma.lessonSchedule.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException("Dars jadvali topilmadi");
    }
    await this.prisma.lessonSchedule.delete({ where: { id } });
    return { id };
  }

  /** Rejadagi dars filialdagi qaysi darslar bilan to'qnashadi (xona, o'qituvchi, guruh) + xona sig'imi. */
  private async conflictsFor(db: Tx | PrismaService, branchId: string, planned: PlannedSlot, excludeIds: string[]): Promise<ScheduleConflict[]> {
    const rows = await db.lessonSchedule.findMany({
      where: {
        branchId,
        weekday: { in: planned.weekdays },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
        OR: [
          { groupId: planned.groupId },
          { employeeId: planned.employeeId },
          ...(planned.roomId ? [{ roomId: planned.roomId }] : []),
        ],
      },
      select: {
        id: true, groupId: true, employeeId: true, roomId: true, weekday: true, startTime: true, endTime: true,
        group: { select: { name: true } }, employee: { select: { fullName: true } }, room: { select: { name: true } },
      },
    });

    let capacity: Parameters<typeof findScheduleConflicts>[2];
    if (planned.roomId) {
      const [room, group, childCount] = await Promise.all([
        db.room.findUnique({ where: { id: planned.roomId }, select: { name: true, capacity: true } }),
        db.group.findUnique({ where: { id: planned.groupId }, select: { name: true } }),
        db.child.count({ where: { groupId: planned.groupId, status: "ACTIVE" } }),
      ]);
      if (room && group) capacity = { roomName: room.name, roomCapacity: room.capacity, groupName: group.name, childCount };
    }

    return findScheduleConflicts(
      planned,
      rows.map((row) => ({
        id: row.id, groupId: row.groupId, employeeId: row.employeeId, roomId: row.roomId, weekday: row.weekday,
        startTime: row.startTime, endTime: row.endTime, groupName: row.group.name, employeeName: row.employee.fullName, roomName: row.room?.name ?? null,
      })),
      capacity,
    );
  }

  /** Dars belgilangani/o'zgargani haqida xodimga ko'rinadigan bildirishnoma yozadi. */
  private async notifyEmployee(
    schedule: {
      branchId: string;
      employeeId: string;
      startTime: string;
      endTime: string;
      group: { name: string };
      room: { name: string } | null;
    },
    weekdays: Weekday[],
  ) {
    const days = weekdays.map((day) => WEEKDAY_LABEL[day]).join(", ");
    const room = schedule.room ? ` «${schedule.room.name}» xonasida` : "";
    await this.prisma.employeeNotification.create({
      data: {
        branchId: schedule.branchId,
        employeeId: schedule.employeeId,
        message: `"${schedule.group.name}" guruhida har ${days} kuni soat ${schedule.startTime}–${schedule.endTime} oralig'ida${room} darsingiz bor.`,
      },
    });
  }

  private async assertBelongsToBranch(db: Tx | PrismaService, branchId: string, groupId: string, employeeId: string, roomId: string | null) {
    const [group, employee, room] = await Promise.all([
      db.group.findFirst({ where: { id: groupId, branchId }, select: { id: true } }),
      db.employee.findFirst({ where: { id: employeeId, branchId }, select: { id: true } }),
      roomId ? db.room.findFirst({ where: { id: roomId, branchId }, select: { id: true } }) : Promise.resolve(true),
    ]);
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (!room) {
      throw new NotFoundException("Xona topilmadi");
    }
  }
}

function assertTimeRange(startTime: string, endTime: string) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new BadRequestException("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
  }
}

/**
 * To'qnashuv bo'lsa — 409, javobda to'qnashuvlar ro'yxati va «Baribir saqlash»
 * mumkinligi (`canForce`). `force` bilan qayta yuborilsa saqlanadi.
 */
function assertNoBlockingConflicts(conflicts: ScheduleConflict[], force?: boolean) {
  const clashes = blocking(conflicts);
  if (clashes.length && !force) {
    throw new ConflictException({
      code: "SCHEDULE_CONFLICT",
      message: clashes.map((conflict) => conflict.message).join("; "),
      details: { conflicts, canForce: true },
    });
  }
}

/**
 * Bir filialning dars jadvaliga bir vaqtda faqat bitta yozuv: ikki admin
 * bir paytda bir xonaga dars qo'ysa, ikkinchisi birinchisining natijasini
 * ko'rib tekshiriladi (tekshiruv va yozish orasida bo'shliq qolmaydi).
 */
async function lockBranchSchedule(tx: Tx, branchId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`lesson-schedule:${branchId}`}))) AS lock_taken`;
}
