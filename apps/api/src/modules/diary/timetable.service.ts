import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope, resolveReadBranchFilter } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds } from "../iam/teacher-scope";
import { SaveTimetableDto } from "./dto/save-timetable.dto";
import { TIMETABLE_DAYS, TIMETABLE_LIMITS, gridFromItems, itemsFromGrid } from "./timetable";

const ROUTINE_SELECT = { id: true, startTime: true, endTime: true, title: true, kind: true, weekdays: true } as const;

/**
 * Haftalik jadval (Vista PDF ko'rinishi) — kundalik kun tartibining jadval
 * ko'rinishi. Ma'lumot `DiaryRoutineItem` da turadi, izoh — `Group.scheduleNote`.
 *
 * Ruxsat: ko'rish — Super Admin (hamma filial), filial admini, administrator,
 * tarbiyachi (faqat o'z guruhi); saqlash — filial admini va administrator.
 * Ota-ona — `ParentDiaryService.timetable`.
 */
@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filialdagi faol guruhlar jadvali bilan birga */
  async list(scope: TenantScope, queryBranchId?: string) {
    if (scope.role === "FINANCE" || scope.role === "CHEF") {
      throw new ForbiddenException("Haftalik jadval bu rol uchun ochiq emas");
    }
    const branchId = resolveReadBranchFilter(scope, queryBranchId);
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const groups = await this.prisma.group.findMany({
      where: {
        status: "ACTIVE",
        branch: { organizationId: scope.organizationId },
        ...(branchId ? { branchId } : {}),
        ...(teacherGroupIds ? { id: { in: teacherGroupIds } } : {}),
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        scheduleNote: true,
        branch: { select: { id: true, name: true } },
        diaryRoutine: { select: ROUTINE_SELECT, orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }] },
      },
    });
    return groups.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      branchId: g.branch.id,
      branchName: g.branch.name,
      note: g.scheduleNote ?? "",
      rows: gridFromItems(g.diaryRoutine),
    }));
  }

  /** Jadvalni butunligicha saqlaydi (kun tartibi bandlari qayta yoziladi) */
  async save(scope: TenantScope, groupId: string, dto: SaveTimetableDto) {
    if (scope.role === "TEACHER") {
      throw new ForbiddenException("Haftalik jadvalni filial admini to'ldiradi");
    }
    const branchId = requireOperationalScope(scope);
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, branchId, branch: { organizationId: scope.organizationId } },
      select: { id: true, name: true, branchId: true, branch: { select: { organizationId: true } } },
    });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }

    const seen = new Set<string>();
    for (const row of dto.rows) {
      if (row.endTime && row.endTime <= row.startTime) {
        throw new BadRequestException(`${row.startTime} qatorida tugash vaqti boshlanishidan keyin bo'lishi kerak`);
      }
      const key = `${row.startTime}|${row.endTime}`;
      if (seen.has(key)) {
        throw new BadRequestException(`${row.startTime}${row.endTime ? `–${row.endTime}` : ""} vaqti ikki marta yozilgan`);
      }
      seen.add(key);
    }

    const existing = await this.prisma.diaryRoutineItem.findMany({ where: { groupId: group.id }, select: ROUTINE_SELECT });
    const planned = itemsFromGrid(dto.rows, existing);
    if (planned.length > TIMETABLE_LIMITS.items) {
      throw new BadRequestException(`Jadval juda katta: ${planned.length} ta band (ko'pi bilan ${TIMETABLE_LIMITS.items})`);
    }
    const keptIds = planned.flatMap((item) => (item.id ? [item.id] : []));

    await this.prisma.$transaction([
      this.prisma.diaryRoutineItem.deleteMany({ where: { groupId: group.id, id: { notIn: keptIds } } }),
      ...planned.map((item, index) => {
        const data = {
          startTime: item.startTime,
          endTime: item.endTime,
          title: item.title,
          kind: item.kind,
          weekdays: item.weekdays,
          sortOrder: index,
        };
        return item.id
          ? this.prisma.diaryRoutineItem.update({ where: { id: item.id }, data })
          : this.prisma.diaryRoutineItem.create({
              data: { ...data, organizationId: group.branch.organizationId, branchId: group.branchId, groupId: group.id },
            });
      }),
      this.prisma.group.update({ where: { id: group.id }, data: { scheduleNote: dto.note?.trim() || null } }),
    ]);

    return this.forGroup(group.id);
  }

  /** Bitta guruh jadvali (ruxsat chaqiruvchida tekshirilgan bo'lishi kerak) */
  async forGroup(groupId: string) {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        scheduleNote: true,
        diaryRoutine: { select: ROUTINE_SELECT, orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }] },
      },
    });
    return {
      groupId: group.id,
      groupName: group.name,
      note: group.scheduleNote ?? "",
      days: TIMETABLE_DAYS,
      rows: gridFromItems(group.diaryRoutine),
    };
  }
}
