import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedParent } from "./parent-auth.types";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ota-onaga biriktirilgan bolalar. Bittadan ko'p bo'lishi mumkin. */
  async children(parent: AuthenticatedParent) {
    const links = await this.prisma.childGuardian.findMany({
      where: { guardianId: parent.id, child: { organizationId: parent.organizationId } },
      include: {
        child: {
          select: {
            id: true,
            publicId: true,
            fullName: true,
            gender: true,
            birthDate: true,
            status: true,
            avatarUpdatedAt: true,
            group: { select: { id: true, name: true } },
            // Manzil kabinetda osmon holatini (quyosh botishi) hisoblash uchun
            branch: { select: { id: true, name: true, address: true } },
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return links.map((link) => ({ ...link.child, relation: link.relation }));
  }

  /**
   * Bolaning bugungi kuni: keldimi, nima yedi, nima bilan shug'ullandi,
   * qancha uxladi va kayfiyati qanday edi.
   */
  async day(parent: AuthenticatedParent, childId: string, dateInput?: string) {
    const child = await this.assertOwnsChild(parent, childId);
    const date = dateInput ?? todayDateString();
    const dateOnly = toDateOnly(date);

    const [attendance, report, menu] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { childId_date: { childId: child.id, date: dateOnly } },
        select: { status: true, note: true },
      }),
      this.prisma.dailyReport.findUnique({
        where: { childId_date: { childId: child.id, date: dateOnly } },
        select: {
          eatingQuality: true,
          sleepMinutes: true,
          mood: true,
          toiletNotes: true,
          activityNotes: true,
          updatedAt: true,
        },
      }),
      // Ovqat menyusi filial bo'yicha, bola bo'yicha emas
      this.prisma.menuEntry.findUnique({
        where: { branchId_date: { branchId: child.branchId, date: dateOnly } },
        select: { breakfast: true, lunch: true, snack: true },
      }),
    ]);

    return {
      date,
      child: {
        id: child.id,
        fullName: child.fullName,
        groupName: child.group?.name ?? null,
        avatarUpdatedAt: child.avatarUpdatedAt?.toISOString() ?? null,
      },
      attendance: attendance ? { status: attendance.status, note: attendance.note } : null,
      report,
      menu,
    };
  }

  /** Oxirgi kunlar davomati — kabinetdagi kichik chiziq uchun. */
  async attendanceStrip(parent: AuthenticatedParent, childId: string, days = 14) {
    const child = await this.assertOwnsChild(parent, childId);
    const to = toDateOnly(todayDateString());
    const from = addDays(to, -(days - 1));

    const records = await this.prisma.attendance.findMany({
      where: { childId: child.id, date: { gte: from, lte: to } },
      select: { date: true, status: true },
    });
    const byDate = new Map(records.map((r) => [r.date.toISOString().slice(0, 10), r.status]));

    const items: { date: string; status: "PRESENT" | "ABSENT" | null }[] = [];
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      const key = cursor.toISOString().slice(0, 10);
      items.push({ date: key, status: byDate.get(key) ?? null });
    }
    const present = items.filter((i) => i.status === "PRESENT").length;
    const absent = items.filter((i) => i.status === "ABSENT").length;
    return { items, present, absent, marked: present + absent };
  }

  /**
   * Bola shu ota-onaga biriktirilganmi. Har bir so'rovda tekshiriladi —
   * kabinetda faqat o'z bolasi ko'rinishi kerak.
   */
  private async assertOwnsChild(parent: AuthenticatedParent, childId: string) {
    const link = await this.prisma.childGuardian.findFirst({
      where: { guardianId: parent.id, childId },
      include: {
        child: {
          select: {
            id: true,
            fullName: true,
            branchId: true,
            avatarUpdatedAt: true,
            organizationId: true,
            group: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!link) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (link.child.organizationId !== parent.organizationId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return link.child;
  }
}
