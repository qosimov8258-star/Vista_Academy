import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireBranchScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsChild } from "../iam/teacher-scope";
import { SubmitWeeklyAssessmentDto } from "./dto/submit-weekly-assessment.dto";

/** Savollar bankida ko'rsatiladigan eng yangi mavzular soni. */
const RECENT_TOPICS_LIMIT = 8;
/** Savol-javob uchun maksimal coin (40) + she'r yodlash uchun (10) = 50/hafta. */
const QA_MAX_COINS = 40;
const POEM_COINS = 10;

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Berilgan (yoki bugungi) sananing shu haftasidagi dushanbasini (vaqtsiz) qaytaradi. */
function mondayOf(dateString: string): Date {
  const date = toDateOnly(dateString);
  const day = date.getUTCDay(); // 0 = Yakshanba ... 6 = Shanba
  const diff = day === 0 ? -6 : 1 - day; // Dushanba = 1
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
}

@Injectable()
export class WeeklyCoinAssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tarbiyachi + bolaning guruhini tekshiradi va filialni qaytaradi. Faqat TEACHER kira oladi. */
  private async requireTeacherAndChild(scope: TenantScope, childId: string) {
    if (scope.role !== "TEACHER") {
      throw new ForbiddenException("Faqat tarbiyachi haftalik baholash kirita oladi");
    }
    const branchId = requireBranchScope(scope);
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
    return child;
  }

  /** Chaqiruvchining xodim kartochkasini topadi. */
  private async requireActingEmployee(scope: TenantScope) {
    const employee = await this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId } });
    if (!employee) {
      throw new BadRequestException("Xodim profili topilmagan");
    }
    return employee;
  }

  /** Bolaning guruhiga tegishli mavzulardan (eng yangi 8 tasi) savollar banki. */
  async listQuestions(scope: TenantScope, childId: string) {
    const child = await this.requireTeacherAndChild(scope, childId);
    if (!child.groupId) {
      return [];
    }

    const topics = await this.prisma.lessonTopic.findMany({
      where: { groupId: child.groupId },
      orderBy: { date: "desc" },
      take: RECENT_TOPICS_LIMIT,
      include: { questions: { orderBy: { createdAt: "asc" } } },
    });

    return topics.map((topic) => ({
      topicId: topic.id,
      topicTitle: topic.title,
      topicDate: topic.date,
      questions: topic.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        answer: q.answer,
      })),
    }));
  }

  async submit(scope: TenantScope, dto: SubmitWeeklyAssessmentDto) {
    const child = await this.requireTeacherAndChild(scope, dto.childId);
    const employee = await this.requireActingEmployee(scope);

    const questionIds = dto.answers.map((a) => a.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException("Bir xil savol qayta yuborilgan");
    }
    if (questionIds.length > 0) {
      const validCount = await this.prisma.topicQuestion.count({
        where: { id: { in: questionIds }, topic: { groupId: child.groupId ?? "__none__" } },
      });
      if (validCount !== questionIds.length) {
        throw new BadRequestException("Ba'zi savollar bu bolaning guruhiga tegishli emas");
      }
    }

    const weekStart = mondayOf(dto.weekStart ?? todayDateString());
    const weekStartLabel = weekStart.toISOString().slice(0, 10);
    const correctCount = dto.answers.filter((a) => a.correct).length;
    const qaCoins = dto.answers.length > 0 ? Math.round((correctCount / dto.answers.length) * QA_MAX_COINS) : 0;
    const poemCoins = dto.poemRecited ? POEM_COINS : 0;
    const coinsAwarded = qaCoins + poemCoins;
    const reason = `Haftalik so'rov (${weekStartLabel} haftasi)`;

    const assessment = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.weeklyCoinAssessment.findUnique({
        where: { childId_weekStart: { childId: child.id, weekStart } },
      });

      if (existing) {
        await tx.coinTransaction.update({
          where: { id: existing.coinTransactionId },
          data: { amount: coinsAwarded, reason },
        });
        await tx.weeklyCoinAssessmentAnswer.deleteMany({ where: { assessmentId: existing.id } });
        return tx.weeklyCoinAssessment.update({
          where: { id: existing.id },
          data: {
            employeeId: employee.id,
            poemRecited: dto.poemRecited,
            coinsAwarded,
            answers: { create: dto.answers.map((a) => ({ questionId: a.questionId, correct: a.correct })) },
          },
          include: { answers: true },
        });
      }

      const coinTransaction = await tx.coinTransaction.create({
        data: {
          organizationId: child.organizationId,
          branchId: child.branchId,
          childId: child.id,
          amount: coinsAwarded,
          source: "WEEKLY_ASSESSMENT",
          reason,
          recordedByUserId: scope.userId,
        },
      });

      return tx.weeklyCoinAssessment.create({
        data: {
          organizationId: child.organizationId,
          branchId: child.branchId,
          childId: child.id,
          employeeId: employee.id,
          weekStart,
          poemRecited: dto.poemRecited,
          coinsAwarded,
          coinTransactionId: coinTransaction.id,
          answers: { create: dto.answers.map((a) => ({ questionId: a.questionId, correct: a.correct })) },
        },
        include: { answers: true },
      });
    });

    return {
      id: assessment.id,
      childId: assessment.childId,
      weekStart: assessment.weekStart,
      poemRecited: assessment.poemRecited,
      coinsAwarded: assessment.coinsAwarded,
      qaCoins,
      poemCoins,
      answers: assessment.answers,
    };
  }

  /** Bolaning haftalik baholash tarixi — eng yangisi birinchi. View-only. */
  async history(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }

    const assessments = await this.prisma.weeklyCoinAssessment.findMany({
      where: { childId: child.id },
      orderBy: { weekStart: "desc" },
      include: {
        employee: { select: { fullName: true } },
        answers: { include: { question: { select: { question: true } } } },
      },
    });

    return assessments.map((a) => ({
      id: a.id,
      weekStart: a.weekStart,
      poemRecited: a.poemRecited,
      coinsAwarded: a.coinsAwarded,
      employee: { fullName: a.employee.fullName },
      answers: a.answers.map((ans) => ({
        question: { question: ans.question.question },
        correct: ans.correct,
      })),
    }));
  }
}
