import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireMoneyScope, resolveReadBranchFilter } from "../iam/tenant-auth.types";
import { UpdateReminderSettingsDto } from "./dto/update-reminder-settings.dto";

const UNPAID_STATUSES: InvoiceStatus[] = [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE];
const TASHKENT_TZ = "Asia/Tashkent";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RenderMessageParams {
  childName: string;
  amount: number;
  dueDate: Date;
  daysLeft: number;
}

/**
 * "To'lov eslatmasi" — moliya bo'limi sozlamalari va ota-ona kabinetidagi
 * eslatma kartasi shu servis orqali ishlaydi. Ruxsat qoidasi `billing.service.ts`
 * dagi `assertFinanceReader` bilan bir xil: faqat Super Admin, filial admini
 * va moliyachi ko'ra/o'zgartira oladi.
 */
@Injectable()
export class PaymentRemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateSettings(scope: TenantScope, branchId?: string) {
    assertFinanceReader(scope);
    const resolvedBranchId = await this.resolveBranchId(scope, branchId);
    return this.upsertSettings(scope.organizationId, resolvedBranchId);
  }

  /** Cron xizmati uchun — endi mavjud sozlama qatoridan branch/org olib chaqiradi, ruxsat tekshiruvi shart emas (tenant HTTP orqali kirilmaydi). */
  async findUnpaidInvoices(
    organizationId: string,
    branchId: string,
    window: { daysBeforeDue: number; daysAfterDue: number },
  ) {
    const today = tashkentTodayUtcMidnight();
    const lowerBound = new Date(today.getTime() - window.daysAfterDue * DAY_MS);
    const upperBound = new Date(today.getTime() + window.daysBeforeDue * DAY_MS);

    return this.prisma.invoice.findMany({
      where: {
        organizationId,
        branchId,
        status: { in: UNPAID_STATUSES },
        dueDate: { gte: lowerBound, lte: upperBound },
      },
      include: {
        child: { select: { id: true, fullName: true, group: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  async updateSettings(scope: TenantScope, dto: UpdateReminderSettingsDto, branchId?: string) {
    // O'zgartirish — pul bo'limidagi yozish amali: Super Admin faqat kuzatadi
    requireMoneyScope(scope);
    const resolvedBranchId = await this.resolveBranchId(scope, branchId);
    const existing = await this.upsertSettings(scope.organizationId, resolvedBranchId);
    return this.prisma.paymentReminderSettings.update({
      where: { id: existing.id },
      data: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.daysBeforeDue !== undefined ? { daysBeforeDue: dto.daysBeforeDue } : {}),
        ...(dto.daysAfterDue !== undefined ? { daysAfterDue: dto.daysAfterDue } : {}),
        ...(dto.sendTimes !== undefined ? { sendTimes: dto.sendTimes } : {}),
        ...(dto.messageTemplate !== undefined ? { messageTemplate: dto.messageTemplate } : {}),
      },
    });
  }

  /**
   * Eslatma oynasida (`daysBeforeDue`/`daysAfterDue`) turgan, hali to'liq
   * to'lanmagan hisob-fakturalar bo'yicha bolalar ro'yxati.
   */
  async listUnpaidChildren(scope: TenantScope, branchId?: string) {
    assertFinanceReader(scope);
    const resolvedBranchId = await this.resolveBranchId(scope, branchId);
    const settings = await this.upsertSettings(scope.organizationId, resolvedBranchId);
    const today = tashkentTodayUtcMidnight();

    const invoices = await this.findUnpaidInvoices(scope.organizationId, resolvedBranchId, settings);

    return invoices.map((invoice) => {
      const remainingAmount = Math.max(
        0,
        Number(invoice.amount) - Number(invoice.discountAmount) - Number(invoice.paidAmount),
      );
      return {
        childId: invoice.child.id,
        childFullName: invoice.child.fullName,
        groupName: invoice.child.group?.name ?? null,
        invoiceId: invoice.id,
        dueDate: invoice.dueDate,
        amount: Number(invoice.amount),
        paidAmount: Number(invoice.paidAmount),
        remainingAmount,
        daysUntilDue: daysBetween(today, invoice.dueDate),
        status: invoice.status,
      };
    });
  }

  /**
   * Ota-ona kabineti (parent module) uchun — chaqiruvchi allaqachon
   * `canViewFinance` va bola egaligini tekshirgan, shuning uchun bu yerda
   * rol tekshiruvi yo'q (guardian TenantScope'ga ega emas).
   */
  async getSettingsForBranch(organizationId: string, branchId: string) {
    return this.upsertSettings(organizationId, branchId);
  }

  /**
   * `{childName}`, `{amount}`, `{dueDate}`, `{daysLeft}` placeholderlarini
   * almashtiradi. `daysLeft` — oddiy son (musbat/manfiy), matnni frontend/shablon
   * o'zi tayyorlaydi ("kun qoldi"/"kun kechikdi" so'zi shablon ichida bo'ladi).
   */
  renderMessage(template: string, params: RenderMessageParams): string {
    return template
      .replace(/\{childName\}/g, params.childName)
      .replace(/\{amount\}/g, formatAmount(params.amount))
      .replace(/\{dueDate\}/g, formatDueDate(params.dueDate))
      .replace(/\{daysLeft\}/g, String(params.daysLeft));
  }

  private async resolveBranchId(scope: TenantScope, queryBranchId?: string): Promise<string> {
    const branchId = resolveReadBranchFilter(scope, queryBranchId);
    if (!branchId) {
      throw new BadRequestException("branchId ko'rsatilishi shart");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    return branchId;
  }

  private async upsertSettings(organizationId: string, branchId: string) {
    return this.prisma.paymentReminderSettings.upsert({
      where: { branchId },
      update: {},
      create: { organizationId, branchId },
    });
  }
}

/**
 * Moliya bo'limi bilan bir xil ruxsat qoidasi (`billing.service.ts`dagi
 * xususiy `assertFinanceReader`ning nusxasi — u yerdan export qilinmagan).
 */
function assertFinanceReader(scope: TenantScope) {
  if (scope.role !== "NETWORK_ADMIN" && scope.role !== "BRANCH_ADMIN" && scope.role !== "FINANCE") {
    throw new ForbiddenException("Bu bo'limni faqat Super Admin, filial admini va moliyachi ko'ra oladi");
  }
}

/** Joriy sana Toshkent taqvimi bo'yicha, UTC yarim tunga tekislangan (dueDate bilan bir xil shaklda solishtirish uchun). */
export function tashkentTodayUtcMidnight(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TASHKENT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Joriy Toshkent vaqti "HH:mm" ko'rinishida — cron uchun. */
export function tashkentCurrentTime(): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TASHKENT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hours = Number(parts.find((p) => p.type === "hour")!.value);
  const minutes = Number(parts.find((p) => p.type === "minute")!.value);
  return { hours, minutes };
}

/** Ikki UTC-yarim-tun sana orasidagi to'liq kunlar soni (b - a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount));
}

function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TASHKENT_TZ, day: "2-digit", month: "2-digit", year: "numeric" })
    .format(date)
    .replace(/\//g, ".");
}
