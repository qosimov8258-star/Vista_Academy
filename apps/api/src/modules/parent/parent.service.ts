import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AttendanceStatus } from "@prisma/client";
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
        select: { status: true, note: true, parentReason: true },
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
      attendance: attendance
        ? { status: attendance.status, note: attendance.note, parentReason: attendance.parentReason }
        : null,
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

    // `AttendanceStatus` LATE/SICK'ni ham o'z ichiga oladi — chiziqda ular
    // ham chizilaveradi, faqat quyidagi present/absent hisobiga kirmaydi.
    const items: { date: string; status: AttendanceStatus | null }[] = [];
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      const key = cursor.toISOString().slice(0, 10);
      items.push({ date: key, status: byDate.get(key) ?? null });
    }
    const present = items.filter((i) => i.status === "PRESENT").length;
    const absent = items.filter((i) => i.status === "ABSENT").length;
    return { items, present, absent, marked: present + absent };
  }

  /**
   * Ota-ona bolasi kelmagan kun uchun sababini yozadi — tarbiyachi buni
   * ko'rgach "Aloqaga chiqish" bosishga hojat qolmaydi. Faqat ABSENT
   * belgilangan kunlar uchun ruxsat berilgan.
   */
  async submitAbsenceReason(parent: AuthenticatedParent, childId: string, date: string, reason: string) {
    const child = await this.assertOwnsChild(parent, childId);
    const dateOnly = toDateOnly(date);
    const existing = await this.prisma.attendance.findUnique({
      where: { childId_date: { childId: child.id, date: dateOnly } },
    });
    if (!existing || existing.status !== "ABSENT") {
      throw new BadRequestException("Faqat kelmagan kun uchun sabab yozish mumkin");
    }
    const updated = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: { parentReason: reason },
      select: { status: true, note: true, parentReason: true },
    });
    return { date, attendance: updated };
  }

  /** Bolaning filialidagi coin do'koni — tovarlar va bolaning joriy balansi. */
  async products(parent: AuthenticatedParent, childId: string) {
    const child = await this.assertOwnsChild(parent, childId);
    const [products, balance] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId: parent.organizationId, branchId: child.branchId },
        orderBy: { createdAt: "desc" },
      }),
      this.coinBalance(child.id),
    ]);
    return { balance, products };
  }

  /**
   * Ota-ona tovarni sotib oladi: zaxira va bola balansi tekshiriladi,
   * so'ng bir tranzaksiyada zaxira kamayadi va balansdan narx yechiladi.
   * Xodim ishtirokisiz, to'liq avtomatik — shuning uchun coin manbasi
   * `PRODUCT_PURCHASE`, admin panelning qo'lda "sotish"idan farqli.
   */
  async purchaseProduct(parent: AuthenticatedParent, childId: string, productId: string) {
    const child = await this.assertOwnsChild(parent, childId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: parent.organizationId, branchId: child.branchId },
    });
    if (!product) {
      throw new NotFoundException("Mahsulot topilmadi");
    }
    if (product.quantity <= 0) {
      throw new BadRequestException("Tovar tugagan");
    }
    const balance = await this.coinBalance(child.id);
    if (balance < product.priceCoins) {
      throw new BadRequestException("Coin yetarli emas");
    }

    const [updatedProduct] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: product.id },
        data: { quantity: { decrement: 1 } },
      }),
      this.prisma.productSale.create({
        data: { productId: product.id, quantity: 1, childId: child.id },
      }),
      this.prisma.coinTransaction.create({
        data: {
          organizationId: parent.organizationId,
          branchId: child.branchId,
          childId: child.id,
          amount: -product.priceCoins,
          reason: `"${product.name}" sotib olindi`,
          source: "PRODUCT_PURCHASE",
        },
      }),
    ]);

    return { product: updatedProduct, balance: balance - product.priceCoins };
  }

  /** Do'kon rasmi — faqat ota-onaning bola(lar)i biriktirilgan filiallar doirasida. */
  async productImage(parent: AuthenticatedParent, productId: string, position: string) {
    if (position !== "1" && position !== "2" && position !== "3") {
      throw new BadRequestException("Rasm o'rni 1, 2 yoki 3 bo'lishi kerak");
    }
    const branchIds = await this.guardianBranchIds(parent);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId: parent.organizationId, branchId: { in: branchIds } },
      select: {
        image1: position === "1",
        image1MimeType: position === "1",
        image2: position === "2",
        image2MimeType: position === "2",
        image3: position === "3",
        image3MimeType: position === "3",
      },
    });
    if (!product) {
      throw new NotFoundException("Mahsulot topilmadi");
    }
    if (position === "1") return { image: product.image1, mimeType: product.image1MimeType };
    if (position === "2") return { image: product.image2, mimeType: product.image2MimeType };
    return { image: product.image3, mimeType: product.image3MimeType };
  }

  /** Bolaning joriy coin balansi — barcha tranzaksiyalar yig'indisi. */
  private async coinBalance(childId: string): Promise<number> {
    const agg = await this.prisma.coinTransaction.aggregate({
      where: { childId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  /** Ota-onaning bola(lar)i biriktirilgan filiallar to'plami. */
  private async guardianBranchIds(parent: AuthenticatedParent): Promise<string[]> {
    const links = await this.prisma.childGuardian.findMany({
      where: { guardianId: parent.id, child: { organizationId: parent.organizationId } },
      select: { child: { select: { branchId: true } } },
    });
    return [...new Set(links.map((link) => link.child.branchId))];
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
