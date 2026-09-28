import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Weekday } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import { LessonAttendanceDayQueryDto } from "./dto/lesson-attendance-day-query.dto";
import { MarkLessonAttendanceDto } from "./dto/mark-lesson-attendance.dto";
import { MyLessonsQueryDto } from "./dto/lesson-attendance-query.dto";

const DEFAULT_TIMEZONE = "Asia/Tashkent";
const WEEKDAYS: Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[date.getUTCDay()];
}

@Injectable()
export class LessonAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** O'qituvchining tanlangan kundagi (odatda bugungi) darslari — vaqt bo'yicha tartiblangan. */
  async myLessons(scope: TenantScope, query: MyLessonsQueryDto) {
    const branchId = requireTeachingScope(scope);
    const employee = await this.requireEmployee(scope);
    const date = toDateOnly(query.date ?? todayDateString());

    const lessons = await this.prisma.lessonSchedule.findMany({
      where: { branchId, employeeId: employee.id, weekday: weekdayOf(date) },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
    });

    return {
      date: date.toISOString().slice(0, 10),
      lessons: lessons.map((lesson) => ({
        scheduleId: lesson.id,
        groupId: lesson.groupId,
        groupName: lesson.group.name,
        subject: lesson.subject,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
      })),
    };
  }

  /** Bitta dars + bitta kun uchun guruhdagi har bir bolaning davomati (bor bo'lsa). */
  async findByLesson(scope: TenantScope, query: LessonAttendanceDayQueryDto) {
    const branchId = requireTeachingScope(scope);
    const employee = await this.requireEmployee(scope);
    const lesson = await this.requireOwnLesson(branchId, employee.id, query.scheduleId);
    const date = toDateOnly(query.date);

    const [children, records] = await Promise.all([
      this.prisma.child.findMany({
        where: { branchId, groupId: lesson.groupId, status: "ACTIVE" },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.lessonAttendance.findMany({ where: { scheduleId: lesson.id, date } }),
    ]);
    const statusByChild = new Map(records.map((record) => [record.childId, record.status]));

    return {
      scheduleId: lesson.id,
      date: date.toISOString().slice(0, 10),
      children: children.map((child) => ({
        childId: child.id,
        fullName: child.fullName,
        status: statusByChild.get(child.id) ?? null,
      })),
    };
  }

  async mark(scope: TenantScope, dto: MarkLessonAttendanceDto) {
    const branchId = requireTeachingScope(scope);
    const employee = await this.requireEmployee(scope);
    const lesson = await this.requireOwnLesson(branchId, employee.id, dto.scheduleId);
    const date = toDateOnly(dto.date);

    if (weekdayOf(date) !== lesson.weekday) {
      throw new BadRequestException("Bu dars tanlangan kunga to'g'ri kelmaydi");
    }
    const child = await this.prisma.child.findFirst({
      where: { id: dto.childId, branchId, groupId: lesson.groupId, status: "ACTIVE" },
    });
    if (!child) {
      throw new NotFoundException("Bola bu guruhda topilmadi");
    }

    const previous = await this.prisma.lessonAttendance.findUnique({
      where: { scheduleId_childId_date: { scheduleId: lesson.id, childId: child.id, date } },
      select: { status: true },
    });
    const record = await this.prisma.lessonAttendance.upsert({
      where: { scheduleId_childId_date: { scheduleId: lesson.id, childId: child.id, date } },
      create: {
        branchId,
        groupId: lesson.groupId,
        childId: child.id,
        employeeId: employee.id,
        scheduleId: lesson.id,
        subject: lesson.subject,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        date,
        status: dto.status,
      },
      update: { status: dto.status, employeeId: employee.id },
    });

    // "Saqlash" qayta bosilganda ota-onaga bir xil xabar takrorlanmasin —
    // faqat yangi belgilash yoki holat o'zgarganda yoziladi.
    if (previous?.status !== dto.status) {
      await this.notifyGuardian(scope.organizationId, child, lesson, dto.date, dto.status);
    }
    return record;
  }

  /** Ota-onaga "farzandingiz ... darsiga kirdi/kelmadi" xabari (kunlik davomatdagi kabi jurnalga yoziladi). */
  private async notifyGuardian(
    organizationId: string,
    child: { id: string; branchId: string; fullName: string },
    lesson: { subject: string | null; startTime: string; endTime: string },
    date: string,
    status: "PRESENT" | "ABSENT",
  ) {
    const link = await this.prisma.childGuardian.findFirst({
      where: { childId: child.id, canReceiveNotifications: true },
      include: { guardian: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    const when = date === todayDateString() ? "bugun" : date;
    const lessonName = lesson.subject ? `${lesson.subject} darsiga` : "darsga";
    const message =
      status === "PRESENT"
        ? `Farzandingiz ${child.fullName} ${when} ${lessonName} soat ${lesson.startTime} da kirdi (${lesson.endTime} gacha).`
        : `Farzandingiz ${child.fullName} ${when} ${lessonName} (${lesson.startTime}–${lesson.endTime}) kelmadi.`;
    await this.notifications.logSystemEvent({
      organizationId,
      branchId: child.branchId,
      childId: child.id,
      eventType: status === "ABSENT" ? "CHILD_ABSENT" : "CUSTOM",
      recipientName: link?.guardian.fullName ?? "Ota-ona",
      message,
    });
  }

  /** Dars shu xodimning o'zi ekanini tekshiradi — boshqa o'qituvchining darsiga belgilab bo'lmaydi. */
  private async requireOwnLesson(branchId: string, employeeId: string, scheduleId: string) {
    const lesson = await this.prisma.lessonSchedule.findFirst({ where: { id: scheduleId, branchId, employeeId } });
    if (!lesson) {
      throw new NotFoundException("Dars topilmadi");
    }
    return lesson;
  }

  private async requireEmployee(scope: TenantScope) {
    const employee = await this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId } });
    if (!employee) {
      throw new BadRequestException("Xodim profilingiz topilmadi — davomatni faqat xodim kartochkasi bor foydalanuvchi belgilay oladi");
    }
    return employee;
  }
}
