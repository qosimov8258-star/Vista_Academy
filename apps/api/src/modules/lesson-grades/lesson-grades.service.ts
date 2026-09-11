import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild, assertTeacherOwnsGroup, resolveTeacherGroupIds, teacherChildWhere } from "../iam/teacher-scope";
import { UpsertLessonGradeDto } from "./dto/upsert-lesson-grade.dto";
import { LessonGradeQueryDto } from "./dto/lesson-grade-query.dto";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class LessonGradesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bitta guruh + bitta kun uchun har bir bolaning bahosi (bor bo'lsa). */
  async findByGroupAndDate(scope: TenantScope, query: LessonGradeQueryDto) {
    const group = await this.requireGroup(scope, query.groupId);
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);

    const date = toDateOnly(query.date ?? todayDateString());
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);

    const [children, grades] = await Promise.all([
      this.prisma.child.findMany({
        where: teacherChildWhere({ groupId: group.id, status: "ACTIVE" }, teacherGroupIds),
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.lessonGrade.findMany({ where: { groupId: group.id, date } }),
    ]);

    const gradeByChild = new Map(grades.map((grade) => [grade.childId, grade]));
    return {
      groupId: group.id,
      date: date.toISOString().slice(0, 10),
      children: children.map((child) => ({
        childId: child.id,
        fullName: child.fullName,
        grade: gradeByChild.get(child.id) ?? null,
      })),
    };
  }

  async upsert(scope: TenantScope, dto: UpsertLessonGradeDto) {
    const branchId = requireTeachingScope(scope);
    const group = await this.requireGroup(scope, dto.groupId);
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);

    const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.groupId !== group.id) {
      throw new BadRequestException("Bola shu guruhda emas");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);

    if (dto.topicId) {
      const topic = await this.prisma.lessonTopic.findFirst({ where: { id: dto.topicId, groupId: group.id } });
      if (!topic) {
        throw new NotFoundException("Mavzu topilmadi");
      }
    }

    const employeeId = await this.resolveActingEmployeeId(scope);
    const date = toDateOnly(dto.date);

    return this.prisma.lessonGrade.upsert({
      where: { childId_date: { childId: dto.childId, date } },
      create: {
        branchId,
        groupId: group.id,
        childId: dto.childId,
        employeeId,
        topicId: dto.topicId,
        date,
        score: dto.score,
        note: dto.note,
      },
      update: {
        groupId: group.id,
        employeeId,
        topicId: dto.topicId,
        score: dto.score,
        note: dto.note,
      },
    });
  }

  /** Bir bolaning baholari tarixi. */
  async findByChild(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
    return this.prisma.lessonGrade.findMany({
      where: { childId },
      orderBy: { date: "desc" },
      take: 60,
    });
  }

  /** Guruh shu tashkilot/filialga tegishli ekanini tekshiradi. */
  private async requireGroup(scope: TenantScope, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, branch: { organizationId: scope.organizationId } },
    });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    if (scope.branchId && group.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu guruhga kirish huquqingiz yo'q");
    }
    return group;
  }

  /** Chaqiruvchining xodim kartochkasini topadi — bahoni kim qo'yganini belgilash uchun. */
  private async resolveActingEmployeeId(scope: TenantScope): Promise<string> {
    const employee = await this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId } });
    if (!employee) {
      throw new BadRequestException(
        "Xodim profilingiz topilmadi — bahoni faqat xodim kartochkasiga ega foydalanuvchi qo'ya oladi",
      );
    }
    return employee.id;
  }
}
