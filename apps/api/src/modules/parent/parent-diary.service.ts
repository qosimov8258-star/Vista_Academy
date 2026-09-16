import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Request, Response } from "express";
import { PrismaService } from "../../database/prisma.service";
import { DiaryDayService } from "../diary/diary-day.service";
import { DIARY_LIMITS, addDays, dateKey, isRealDate, toDateOnly, todayIn } from "../diary/diary.constants";
import { AuthenticatedParent } from "./parent-auth.types";

/**
 * Ota-ona kabinetidagi "Kundalik" — faqat o'qish. Bola qaysi guruhda bo'lsa,
 * o'sha guruhning kun tartibi va lahzalari ko'rinadi.
 *
 * Tarbiyachi tomoni: `DiaryController` (`/app/diary/*`).
 */
@Injectable()
export class ParentDiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly days: DiaryDayService,
  ) {}

  async day(parent: AuthenticatedParent, childId: string, dateInput?: string) {
    const child = await this.ownChild(parent, childId);
    const today = todayIn(child.branch.timezone);
    const date = dateInput ?? today;
    if (!isRealDate(date)) {
      throw new BadRequestException("Sana YYYY-MM-DD formatida bo'lishi kerak");
    }
    if (date > today) {
      throw new BadRequestException("Bu kun hali kelmagan");
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: { childId_date: { childId: child.id, date: toDateOnly(date) } },
      select: { status: true },
    });

    // Guruhga biriktirilmagan bola — kundalik yo'q, lekin sahifa buzilmasin
    if (!child.group) {
      return {
        date,
        today,
        weekday: null,
        group: null,
        attendance: attendance?.status ?? null,
        items: [],
        media: [],
        summary: { total: 0, done: 0, photos: 0, videos: 0 },
      };
    }

    const view = await this.days.buildDay(child.group, date);
    return { ...view, today, attendance: attendance?.status ?? null };
  }

  /** Kunlar tasmasi: oxirgi `count` kun (bugun birinchi) */
  async recentDays(parent: AuthenticatedParent, childId: string, count = 14) {
    const child = await this.ownChild(parent, childId);
    const days = Math.min(Math.max(Math.trunc(count) || 14, 1), DIARY_LIMITS.parentDaysMax);
    const today = todayIn(child.branch.timezone);
    const from = dateKey(addDays(toDateOnly(today), -(days - 1)));
    if (!child.group) {
      return [];
    }
    return this.days.summaries(child.group.id, from, today);
  }

  /**
   * Faylni yuboradi. Ota-onaning shu guruhda bolasi bo'lishi shart — boshqa
   * guruh fayli bo'lsa 404 (borligi ham bilinmasin).
   */
  async sendMedia(parent: AuthenticatedParent, mediaId: string, variant: "file" | "poster", req: Request, res: Response) {
    const groupId = await this.days.mediaGroupId(mediaId);
    const link = await this.prisma.childGuardian.findFirst({
      where: { guardianId: parent.id, child: { organizationId: parent.organizationId, groupId } },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException("Fayl topilmadi");
    }
    await this.days.send(mediaId, variant, req, res);
  }

  private async ownChild(parent: AuthenticatedParent, childId: string) {
    const link = await this.prisma.childGuardian.findFirst({
      where: { guardianId: parent.id, childId, child: { organizationId: parent.organizationId } },
      select: {
        child: {
          select: {
            id: true,
            group: { select: { id: true, name: true } },
            branch: { select: { timezone: true } },
          },
        },
      },
    });
    if (!link) {
      throw new NotFoundException("Bola topilmadi");
    }
    return link.child;
  }
}
