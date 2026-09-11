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
  room: { select: { id: true, name: true } },
  employee: { select: { id: true, fullName: true } },
} satisfies Prisma.LessonScheduleInclude;

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

    await this.assertBelongsToBranch(branchId, dto.groupId, dto.roomId, dto.employeeId);
    await this.assertNoOverlap(dto.roomId, dto.weekday, startMinutes, endMinutes);

    return this.prisma.lessonSchedule.create({
      data: {
        branchId,
        groupId: dto.groupId,
        employeeId: dto.employeeId,
        roomId: dto.roomId,
        subject: dto.subject,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: scheduleInclude,
    });
  }

  async update(scope: TenantScope, id: string, dto: UpdateLessonScheduleDto) {
    const branchId = requireOperationalScope(scope);
    const existing = await this.prisma.lessonSchedule.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException("Dars jadvali topilmadi");
    }

    const groupId = dto.groupId ?? existing.groupId;
    const roomId = dto.roomId ?? existing.roomId;
    const employeeId = dto.employeeId ?? existing.employeeId;
    const weekday = dto.weekday ?? existing.weekday;
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
    }

    if (dto.groupId || dto.roomId || dto.employeeId) {
      await this.assertBelongsToBranch(branchId, groupId, roomId, employeeId);
    }
    await this.assertNoOverlap(roomId, weekday, startMinutes, endMinutes, id);

    return this.prisma.lessonSchedule.update({
      where: { id },
      data: {
        groupId: dto.groupId,
        roomId: dto.roomId,
        employeeId: dto.employeeId,
        subject: dto.subject,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: scheduleInclude,
    });
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

  private async assertBelongsToBranch(branchId: string, groupId: string, roomId: string, employeeId: string) {
    const [group, room, employee] = await Promise.all([
      this.prisma.group.findFirst({ where: { id: groupId, branchId } }),
      this.prisma.room.findFirst({ where: { id: roomId, branchId } }),
      this.prisma.employee.findFirst({ where: { id: employeeId, branchId } }),
    ]);
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (!room) {
      throw new NotFoundException("Xona topilmadi");
    }
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
  }

  /** Bir xona bir vaqtda ikki guruhga berilmasin. */
  private async assertNoOverlap(
    roomId: string,
    weekday: Weekday,
    startMinutes: number,
    endMinutes: number,
    excludeId?: string,
  ) {
    const existing = await this.prisma.lessonSchedule.findMany({
      where: { roomId, weekday, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { startTime: true, endTime: true },
    });
    const overlaps = existing.some((row) => {
      const rowStart = timeToMinutes(row.startTime);
      const rowEnd = timeToMinutes(row.endTime);
      return startMinutes < rowEnd && rowStart < endMinutes;
    });
    if (overlaps) {
      throw new ConflictException("Bu xona shu kun va vaqtda band");
    }
  }
}
