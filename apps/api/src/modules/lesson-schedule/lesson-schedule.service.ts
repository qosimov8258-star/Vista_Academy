import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Weekday } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds, withTeacherGroupFilter } from "../iam/teacher-scope";
import { CreateLessonScheduleDto } from "./dto/create-lesson-schedule.dto";
import { UpdateLessonScheduleDto } from "./dto/update-lesson-schedule.dto";
import { LessonScheduleQueryDto } from "./dto/lesson-schedule-query.dto";

const scheduleInclude = {
  group: { select: { id: true, name: true } },
  employee: { select: { id: true, fullName: true } },
} satisfies Prisma.LessonScheduleInclude;

const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: "dushanba",
  TUESDAY: "seshanba",
  WEDNESDAY: "chorshanba",
  THURSDAY: "payshanba",
  FRIDAY: "juma",
  SATURDAY: "shanba",
  SUNDAY: "yakshanba",
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

@Injectable()
export class LessonScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ko'rish: o'qituvchi faqat o'z guruhlarini, admin/administrator butun
   * filialni (yoki `groupId` bilan filtrlab) ko'radi.
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

    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    if (query.groupId && teacherGroupIds !== null && !teacherGroupIds.includes(query.groupId)) {
      throw new ForbiddenException("Bu guruh sizga biriktirilmagan");
    }

    const where = withTeacherGroupFilter(
      { branchId, ...(query.groupId ? { groupId: query.groupId } : {}) },
      teacherGroupIds,
    );

    return this.prisma.lessonSchedule.findMany({
      where,
      include: scheduleInclude,
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  }

  /** Yozish — faqat filial admini va administrator. */
  async create(scope: TenantScope, dto: CreateLessonScheduleDto) {
    const branchId = requireOperationalScope(scope);
    const startMinutes = timeToMinutes(dto.startTime);
    const endMinutes = timeToMinutes(dto.endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
    }

    await this.assertBelongsToBranch(branchId, dto.groupId, dto.employeeId);
    await this.assertNoOverlap(dto.groupId, dto.weekday, startMinutes, endMinutes);

    const created = await this.prisma.lessonSchedule.create({
      data: {
        branchId,
        groupId: dto.groupId,
        employeeId: dto.employeeId,
        subject: dto.subject,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: scheduleInclude,
    });
    await this.notifyEmployee(created);
    return created;
  }

  async update(scope: TenantScope, id: string, dto: UpdateLessonScheduleDto) {
    const branchId = requireOperationalScope(scope);
    const existing = await this.prisma.lessonSchedule.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException("Dars jadvali topilmadi");
    }

    const groupId = dto.groupId ?? existing.groupId;
    const employeeId = dto.employeeId ?? existing.employeeId;
    const weekday = dto.weekday ?? existing.weekday;
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
    }

    if (dto.groupId || dto.employeeId) {
      await this.assertBelongsToBranch(branchId, groupId, employeeId);
    }
    await this.assertNoOverlap(groupId, weekday, startMinutes, endMinutes, id);

    const updated = await this.prisma.lessonSchedule.update({
      where: { id },
      data: {
        groupId: dto.groupId,
        employeeId: dto.employeeId,
        subject: dto.subject,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: scheduleInclude,
    });
    // Xodim, guruh, kun yoki vaqt o'zgarsa — o'qituvchi qayta xabardor qilinadi.
    if (dto.groupId || dto.employeeId || dto.weekday || dto.startTime || dto.endTime) {
      await this.notifyEmployee(updated);
    }
    return updated;
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

  /** Dars belgilangani/o'zgargani haqida xodimga ko'rinadigan bildirishnoma yozadi. */
  private async notifyEmployee(schedule: {
    branchId: string;
    employeeId: string;
    weekday: Weekday;
    startTime: string;
    endTime: string;
    group: { name: string };
  }) {
    await this.prisma.employeeNotification.create({
      data: {
        branchId: schedule.branchId,
        employeeId: schedule.employeeId,
        message: `"${schedule.group.name}" guruhida har ${WEEKDAY_LABEL[schedule.weekday]} kuni soat ${schedule.startTime}–${schedule.endTime} oralig'ida darsingiz bor.`,
      },
    });
  }

  private async assertBelongsToBranch(branchId: string, groupId: string, employeeId: string) {
    const [group, employee] = await Promise.all([
      this.prisma.group.findFirst({ where: { id: groupId, branchId } }),
      this.prisma.employee.findFirst({ where: { id: employeeId, branchId } }),
    ]);
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
  }

  /** Bir guruhda bir vaqtda ikkita dars bo'lmasin. */
  private async assertNoOverlap(
    groupId: string,
    weekday: Weekday,
    startMinutes: number,
    endMinutes: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.lessonSchedule.findMany({
      where: { groupId, weekday, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { startTime: true, endTime: true },
    });
    const overlaps = existing.some((row) => {
      const rowStart = timeToMinutes(row.startTime);
      const rowEnd = timeToMinutes(row.endTime);
      return startMinutes < rowEnd && rowStart < endMinutes;
    });
    if (overlaps) {
      throw new ConflictException("Bu guruhda shu kun va vaqtda allaqachon dars bor");
    }
  }
}
