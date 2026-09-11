import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsGroup } from "../iam/teacher-scope";
import { CreateLessonTopicDto } from "./dto/create-lesson-topic.dto";
import { UpdateLessonTopicDto } from "./dto/update-lesson-topic.dto";
import { LessonTopicQueryDto } from "./dto/lesson-topic-query.dto";
import { CreateTopicQuestionDto } from "./dto/create-topic-question.dto";
import { UpdateTopicQuestionDto } from "./dto/update-topic-question.dto";

/** Mavzu shuncha oydan eskirgan bo'lsa, davriy ko'rikdan o'tkazish tavsiya etiladi. */
const REVIEW_DUE_MONTHS = 2;

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Alohida DB maydonisiz — mavzu sanasidan hisoblab chiqiladi. */
function isReviewDue(date: Date): boolean {
  const threshold = new Date();
  threshold.setUTCMonth(threshold.getUTCMonth() - REVIEW_DUE_MONTHS);
  return date.getTime() <= threshold.getTime();
}

@Injectable()
export class LessonTopicsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Guruh bo'yicha mavzular ro'yxati — savollar soni va ko'rik kerakligi bilan. */
  async findAll(scope: TenantScope, query: LessonTopicQueryDto) {
    const group = await this.requireGroup(scope, query.groupId);
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);

    const topics = await this.prisma.lessonTopic.findMany({
      where: { groupId: group.id },
      include: { _count: { select: { questions: true } } },
      orderBy: { date: "desc" },
    });

    return topics.map((topic) => ({ ...topic, reviewDue: isReviewDue(topic.date) }));
  }

  /** Mavzu detali — savollar banki bilan birga. */
  async findOne(scope: TenantScope, id: string) {
    const topic = await this.requireTopic(scope, id);
    const full = await this.prisma.lessonTopic.findUniqueOrThrow({
      where: { id: topic.id },
      include: { questions: { orderBy: { createdAt: "asc" } } },
    });
    return { ...full, reviewDue: isReviewDue(full.date) };
  }

  async create(scope: TenantScope, dto: CreateLessonTopicDto) {
    const branchId = requireTeachingScope(scope);
    const group = await this.requireGroup(scope, dto.groupId);
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);
    const employeeId = await this.resolveActingEmployeeId(scope);

    return this.prisma.lessonTopic.create({
      data: {
        branchId,
        groupId: group.id,
        employeeId,
        subject: dto.subject,
        title: dto.title,
        date: toDateOnly(dto.date),
      },
    });
  }

  async update(scope: TenantScope, id: string, dto: UpdateLessonTopicDto) {
    requireTeachingScope(scope);
    const topic = await this.requireTopic(scope, id);
    return this.prisma.lessonTopic.update({
      where: { id: topic.id },
      data: {
        title: dto.title,
        subject: dto.subject,
        date: dto.date ? toDateOnly(dto.date) : undefined,
      },
    });
  }

  async remove(scope: TenantScope, id: string) {
    requireTeachingScope(scope);
    const topic = await this.requireTopic(scope, id);
    await this.prisma.lessonTopic.delete({ where: { id: topic.id } });
    return { id: topic.id };
  }

  async addQuestion(scope: TenantScope, topicId: string, dto: CreateTopicQuestionDto) {
    requireTeachingScope(scope);
    const topic = await this.requireTopic(scope, topicId);
    return this.prisma.topicQuestion.create({
      data: {
        topicId: topic.id,
        question: dto.question,
        options: dto.options ?? [],
        answer: dto.answer,
      },
    });
  }

  async updateQuestion(scope: TenantScope, questionId: string, dto: UpdateTopicQuestionDto) {
    requireTeachingScope(scope);
    const question = await this.requireQuestion(scope, questionId);
    return this.prisma.topicQuestion.update({
      where: { id: question.id },
      data: {
        question: dto.question,
        options: dto.options,
        answer: dto.answer,
      },
    });
  }

  async removeQuestion(scope: TenantScope, questionId: string) {
    requireTeachingScope(scope);
    const question = await this.requireQuestion(scope, questionId);
    await this.prisma.topicQuestion.delete({ where: { id: question.id } });
    return { id: question.id };
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

  /** Mavzu shu tashkilotga tegishli va chaqiruvchi shu guruhga ega ekanini tekshiradi. */
  private async requireTopic(scope: TenantScope, id: string) {
    const topic = await this.prisma.lessonTopic.findFirst({
      where: { id, branch: { organizationId: scope.organizationId } },
    });
    if (!topic) {
      throw new NotFoundException("Mavzu topilmadi");
    }
    if (scope.branchId && topic.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu mavzuga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsGroup(this.prisma, scope, topic.groupId);
    return topic;
  }

  /** Savol shu tashkilotga tegishli mavzuga bog'liq ekanini tekshiradi. */
  private async requireQuestion(scope: TenantScope, id: string) {
    const question = await this.prisma.topicQuestion.findFirst({
      where: { id, topic: { branch: { organizationId: scope.organizationId } } },
      include: { topic: true },
    });
    if (!question) {
      throw new NotFoundException("Savol topilmadi");
    }
    if (scope.branchId && question.topic.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu savolga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsGroup(this.prisma, scope, question.topic.groupId);
    return question;
  }

  /** Chaqiruvchining xodim kartochkasini topadi — mavzu muallifini belgilash uchun. */
  private async resolveActingEmployeeId(scope: TenantScope): Promise<string> {
    const employee = await this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId } });
    if (!employee) {
      throw new BadRequestException(
        "Xodim profilingiz topilmadi — mavzuni faqat xodim kartochkasiga ega foydalanuvchi qo'sha oladi",
      );
    }
    return employee.id;
  }
}
