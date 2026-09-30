import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, type AttendanceStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedParent } from "./parent-auth.types";
import { PaymentRemindersService, daysBetween, tashkentTodayUtcMidnight } from "../payment-reminders/payment-reminders.service";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentRemindersService: PaymentRemindersService,
  ) {}

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

    const [attendance, report, menu, menuPhotos] = await Promise.all([
      this.prisma.attendance.findUnique({
        where: { childId_date: { childId: child.id, date: dateOnly } },
        select: { status: true, note: true, parentReason: true, checkInTime: true, checkOutTime: true },
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
      // Oshpaz yuklagan taom suratlari — faqat ro'yxat, surat alohida so'raladi
      this.prisma.menuPhoto.findMany({
        where: { branchId: child.branchId, date: dateOnly },
        select: { id: true, meal: true },
        orderBy: { createdAt: "asc" },
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
        ? {
            status: attendance.status,
            note: attendance.note,
            parentReason: attendance.parentReason,
            // Yuz tanish terminali yozgan kelish/ketish vaqti ("HH:MM")
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
          }
        : null,
      report,
      menu,
      menuPhotos,
    };
  }

  /** Taom surati — faqat bolaning filialiga tegishli bo'lsa beriladi */
  async readMenuPhoto(parent: AuthenticatedParent, childId: string, photoId: string) {
    const child = await this.assertOwnsChild(parent, childId);
    const photo = await this.prisma.menuPhoto.findFirst({
      where: { id: photoId, branchId: child.branchId },
      select: { image: true, imageKey: true, mimeType: true },
    });
    if (!photo) {
      throw new NotFoundException("Rasm topilmadi");
    }
    return photo;
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
        image1Key: position === "1",
        image1MimeType: position === "1",
        image2: position === "2",
        image2Key: position === "2",
        image2MimeType: position === "2",
        image3: position === "3",
        image3Key: position === "3",
        image3MimeType: position === "3",
      },
    });
    if (!product) {
      throw new NotFoundException("Mahsulot topilmadi");
    }
    if (position === "1") return { image: product.image1, key: product.image1Key, mimeType: product.image1MimeType };
    if (position === "2") return { image: product.image2, key: product.image2Key, mimeType: product.image2MimeType };
    return { image: product.image3, key: product.image3Key, mimeType: product.image3MimeType };
  }

  /**
   * To'lov eslatmasi kartasi — faqat `ChildGuardian.canViewFinance` yoqilgan
   * ota-onaga ko'rinadi. Hisob-kitob har safar jonli qilinadi (cron/dispatch
   * tarixiga bog'liq emas), shuning uchun kabinet ochilgan har lahzada aniq
   * holatni ko'rsatadi. To'lanmaguncha ko'rinishda qoladi — hatto eslatma
   * oynasidan (`daysAfterDue`) uzoq chiqib ketgan qarzdorlik uchun ham.
   */
  async paymentReminder(parent: AuthenticatedParent, childId: string) {
    const link = await this.prisma.childGuardian.findFirst({
      where: { guardianId: parent.id, childId },
      select: {
        canViewFinance: true,
        child: { select: { id: true, fullName: true, branchId: true, organizationId: true } },
      },
    });
    if (!link || link.child.organizationId !== parent.organizationId) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (!link.canViewFinance) {
      return { visible: false as const };
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        childId: link.child.id,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      orderBy: { dueDate: "asc" },
    });
    if (!invoice) {
      return { visible: false as const };
    }

    const settings = await this.paymentRemindersService.getSettingsForBranch(parent.organizationId, invoice.branchId);
    if (!settings.isEnabled) {
      return { visible: false as const };
    }

    const today = tashkentTodayUtcMidnight();
    const daysUntilDue = daysBetween(today, invoice.dueDate);
    // Hali erta — eslatma oynasi boshlanmagan
    if (daysUntilDue > settings.daysBeforeDue) {
      return { visible: false as const };
    }

    const remainingAmount = Math.max(
      0,
      Number(invoice.amount) - Number(invoice.discountAmount) - Number(invoice.paidAmount),
    );
    const message = this.paymentRemindersService.renderMessage(settings.messageTemplate, {
      childName: link.child.fullName,
      amount: remainingAmount,
      dueDate: invoice.dueDate,
      daysLeft: daysUntilDue,
    });

    return {
      visible: true as const,
      message,
      amount: remainingAmount,
      dueDate: invoice.dueDate,
      daysUntilDue,
      overdue: daysUntilDue < 0,
    };
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
