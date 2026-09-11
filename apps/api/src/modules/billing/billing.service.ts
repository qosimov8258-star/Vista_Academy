import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireMoneyScope, toTenantScope } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { BulkCreateInvoiceDto } from "./dto/bulk-create-invoice.dto";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";
import { FinanceChildrenQueryDto, FinanceSummaryQueryDto } from "./dto/finance-query.dto";

const EPSILON = 0.01;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(caller: TenantAuthenticatedUser, dto: CreateInvoiceDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const [child, branch] = await Promise.all([
      this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } }),
      this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { currency: true } }),
    ]);
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }

    const discountAmount = dto.discountAmount ?? 0;
    if (discountAmount > dto.amount) {
      throw new BadRequestException("Chegirma summadan katta bo'lishi mumkin emas");
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childId: child.id,
          amount: dto.amount,
          discountAmount,
          // Frontenddan kelgan `currency` ishlatilmaydi — filialning o'zida
          // sozlangan valyuta olinadi, shunda "UZS"ga qattiq qolib ketish
          // xatosi umuman takrorlanmaydi.
          currency: branch.currency,
          period: dto.period,
          dueDate: new Date(dto.dueDate),
        },
      });

      await tx.ledgerEntry.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childId: child.id,
          type: "CHARGE",
          amount: dto.amount,
          invoiceId: invoice.id,
          note: `Hisob-faktura — ${dto.period}`,
        },
      });

      if (discountAmount > 0) {
        await tx.ledgerEntry.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            childId: child.id,
            type: "DISCOUNT",
            amount: -discountAmount,
            invoiceId: invoice.id,
            note: "Chegirma",
          },
        });
      }

      return invoice;
    }).then(async (invoice) => {
      await this.auditLog.logFromUser(caller, {
        action: "invoice.create",
        entityType: "Invoice",
        entityId: invoice.id,
        branchId,
        summary: `${child.fullName} uchun ${dto.period} davri uchun hisob-faktura yaratildi (${dto.amount} ${branch.currency})`,
      });
      return invoice;
    });
  }

  /**
   * Guruh yoki butun filial bo'yicha bir xil summada hisob-faktura yaratadi
   * — o'quv yili/oy boshida bittalab yaratishning o'rnini bosadi. Shu davr
   * uchun allaqachon hisob-fakturasi bor bola tashlab ketiladi (qayta
   * bosilsa ikki marta yaratilmasin).
   */
  async bulkCreate(caller: TenantAuthenticatedUser, dto: BulkCreateInvoiceDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);

    if (dto.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: dto.groupId, branchId } });
      if (!group) {
        throw new NotFoundException("Guruh topilmadi");
      }
    }

    const children = await this.prisma.child.findMany({
      where: {
        branchId,
        status: "ACTIVE",
        ...(dto.groupId ? { groupId: dto.groupId } : {}),
      },
      select: { id: true },
    });
    if (children.length === 0) {
      throw new BadRequestException("Bu tanlovda faol bola yo'q");
    }

    // Bekor qilingan (CANCELLED) hisob-faktura hisobga olinmaydi — aks holda
    // xato bosilib bekor qilingan bola shu davr uchun umuman qayta hisob-
    // faktura ololmay qolardi.
    const existing = await this.prisma.invoice.findMany({
      where: {
        branchId,
        period: dto.period,
        childId: { in: children.map((c) => c.id) },
        status: { not: InvoiceStatus.CANCELLED },
      },
      select: { childId: true },
    });
    const alreadyInvoiced = new Set(existing.map((i) => i.childId));
    const targets = children.filter((c) => !alreadyInvoiced.has(c.id));

    const created = [];
    for (const child of targets) {
      created.push(
        await this.create(caller, {
          childId: child.id,
          amount: dto.amount,
          discountAmount: dto.discountAmount,
          period: dto.period,
          dueDate: dto.dueDate,
        }),
      );
    }

    return { createdCount: created.length, skippedCount: children.length - targets.length };
  }

  async findAll(scope: TenantScope, query: InvoiceQueryDto) {
    assertMoneyReader(scope);
    const now = new Date();
    const where: Prisma.InvoiceWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.childId ? { childId: query.childId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.period ? { period: query.period } : {}),
      ...(query.search ? { child: { fullName: { contains: query.search, mode: "insensitive" } } } : {}),
      ...(query.overdueOnly
        ? { status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] }, dueDate: { lt: now } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { child: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    // `status` bazada hech qachon OVERDUE bo'lib yozilmaydi (pastga qarang) —
    // shuning uchun har bir yozuvga kechikkanini alohida hisoblab qo'shamiz.
    const data = items.map((item) => ({
      ...item,
      overdue:
        (item.status === InvoiceStatus.PENDING || item.status === InvoiceStatus.PARTIALLY_PAID) &&
        item.dueDate < now,
    }));

    return { data, meta: { page: query.page, limit: query.limit, total } };
  }

  async recordPayment(caller: TenantAuthenticatedUser, dto: RecordPaymentDto) {
    const scope = toTenantScope(caller);
    const recordedByUserId = caller.id;
    const branchId = requireMoneyScope(scope);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, organizationId: scope.organizationId },
    });
    if (!invoice) {
      throw new NotFoundException("Hisob-faktura topilmadi");
    }
    if (invoice.branchId !== branchId) {
      throw new ForbiddenException("Bu hisob-fakturaga kirish huquqingiz yo'q");
    }
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      throw new BadRequestException("Bu hisob-faktura bo'yicha to'lov qabul qilib bo'lmaydi");
    }

    const netPayable = Number(invoice.amount) - Number(invoice.discountAmount);
    const remaining = netPayable - Number(invoice.paidAmount);
    const amount = dto.amount ?? remaining;
    if (amount <= 0) {
      throw new BadRequestException("Summa musbat bo'lishi kerak");
    }
    if (amount > remaining + EPSILON) {
      throw new BadRequestException("Summa qolgan qarzdan katta bo'lishi mumkin emas");
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childId: invoice.childId,
          amount,
          currency: invoice.currency,
          method: dto.method ?? "CASH",
          note: dto.note,
          recordedByUserId,
        },
      });

      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, invoiceId: invoice.id, amount },
      });

      const newPaidAmount = Number(invoice.paidAmount) + amount;
      const isFullyPaid = newPaidAmount >= netPayable - EPSILON;
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          paidAt: isFullyPaid ? new Date() : invoice.paidAt,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childId: invoice.childId,
          type: "PAYMENT",
          amount: -amount,
          invoiceId: invoice.id,
          paymentId: payment.id,
          note: `To'lov (${dto.method ?? "CASH"})`,
        },
      });

      return { payment, invoice: updatedInvoice };
    }).then(async (result) => {
      await this.auditLog.logFromUser(caller, {
        action: "payment.record",
        entityType: "Payment",
        entityId: result.payment.id,
        branchId,
        summary: `Hisob-faktura (${invoice.period}) uchun ${amount} ${invoice.currency} to'lov qabul qilindi`,
      });
      return result;
    });
  }

  async refundPayment(caller: TenantAuthenticatedUser, paymentId: string) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: scope.organizationId },
      include: { allocations: { include: { invoice: true } } },
    });
    if (!payment) {
      throw new NotFoundException("To'lov topilmadi");
    }
    if (payment.branchId !== branchId) {
      throw new ForbiddenException("Bu to'lovga kirish huquqingiz yo'q");
    }
    if (payment.status === "REFUNDED") {
      throw new BadRequestException("To'lov allaqachon qaytarilgan");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const allocation of payment.allocations) {
        const invoice = allocation.invoice;
        const netPayable = Number(invoice.amount) - Number(invoice.discountAmount);
        const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - Number(allocation.amount));
        const newStatus =
          newPaidAmount <= EPSILON
            ? InvoiceStatus.PENDING
            : newPaidAmount < netPayable - EPSILON
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.PAID;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
            paidAt: newStatus === InvoiceStatus.PAID ? invoice.paidAt : null,
          },
        });
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });

      await tx.ledgerEntry.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childId: payment.childId,
          type: "REFUND",
          amount: Number(payment.amount),
          paymentId: payment.id,
          note: "To'lov qaytarildi",
        },
      });

      return updatedPayment;
    }).then(async (updatedPayment) => {
      await this.auditLog.logFromUser(caller, {
        action: "payment.refund",
        entityType: "Payment",
        entityId: updatedPayment.id,
        branchId,
        summary: `${payment.amount} ${payment.currency} to'lov qaytarildi`,
      });
      return updatedPayment;
    });
  }

  async findPayments(scope: TenantScope, query: PaymentQueryDto) {
    assertMoneyReader(scope);
    const where: Prisma.PaymentWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.childId ? { childId: query.childId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { child: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  async childLedger(scope: TenantScope, childId: string) {
    assertMoneyReader(scope);
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }

    return this.prisma.ledgerEntry.findMany({
      where: { childId },
      orderBy: { createdAt: "desc" },
      include: {
        invoice: { select: { id: true, period: true } },
        payment: { select: { id: true, method: true, status: true } },
      },
    });
  }

  async monthRevenue(scope: TenantScope): Promise<number> {
    const { start, end } = currentMonthRange();
    const result = await this.prisma.payment.aggregate({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        status: "COMPLETED",
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /** O'tgan oyning daromadi — joriy oy bilan taqqoslash uchun. */
  async previousMonthRevenue(scope: TenantScope): Promise<number> {
    const { start, end } = previousMonthRange();
    const result = await this.prisma.payment.aggregate({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        status: "COMPLETED",
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /** Muddati o'tgan fakturalar soni — Bosh sahifadagi ogohlantirish uchun. */
  async overdueInvoicesCount(scope: TenantScope): Promise<number> {
    return this.prisma.invoice.count({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: new Date() },
      },
    });
  }

  /**
   * Muddati o'tgan fakturalar uchun `PAYMENT_OVERDUE` bildirishnomasi.
   * `status` bazada OVERDUE bo'lib yozilmaydi (yuqoriga qarang), shuning
   * uchun alohida "muddati o'tganda darhol yoziladigan" hodisa yo'q —
   * Bosh sahifa ochilganda shu yerdan chaqirib, kun ichida bir marta
   * (bola boshiga) yetishmayotgan bildirishnomani to'ldiramiz.
   */
  async syncOverdueNotifications(scope: TenantScope): Promise<void> {
    const overdue = await this.prisma.invoice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { lt: new Date() },
      },
      select: { branchId: true, childId: true, dueDate: true, child: { select: { fullName: true } } },
    });
    if (overdue.length === 0) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyNotified = await this.prisma.notificationLog.findMany({
      where: {
        childId: { in: overdue.map((invoice) => invoice.childId) },
        eventType: "PAYMENT_OVERDUE",
        createdAt: { gte: todayStart },
      },
      select: { childId: true },
    });
    const notified = new Set(alreadyNotified.map((n) => n.childId));

    for (const invoice of overdue) {
      if (notified.has(invoice.childId)) continue;
      notified.add(invoice.childId);
      const link = await this.prisma.childGuardian.findFirst({
        where: { childId: invoice.childId, canReceiveNotifications: true },
        include: { guardian: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      await this.notifications.logSystemEvent({
        organizationId: scope.organizationId,
        branchId: invoice.branchId,
        childId: invoice.childId,
        eventType: "PAYMENT_OVERDUE",
        recipientName: link?.guardian.fullName ?? "Ota-ona",
        message: `${invoice.child.fullName} uchun hisob-faktura muddati o'tdi (${invoice.dueDate.toISOString().slice(0, 10)}).`,
      });
    }
  }

  /** Bosh sahifadagi "eng ko'p qarzdorlar" vidjeti uchun. */
  async topDebtors(scope: TenantScope, limit = 5) {
    const branchId = scope.branchId;
    if (!branchId) return [];
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      select: {
        amount: true,
        discountAmount: true,
        paidAmount: true,
        childId: true,
        child: { select: { fullName: true } },
      },
    });
    const byChild = new Map<string, { childId: string; fullName: string; balance: number }>();
    for (const invoice of invoices) {
      const remaining = Number(invoice.amount) - Number(invoice.discountAmount) - Number(invoice.paidAmount);
      const existing = byChild.get(invoice.childId) ?? {
        childId: invoice.childId,
        fullName: invoice.child.fullName,
        balance: 0,
      };
      existing.balance += remaining;
      byChild.set(invoice.childId, existing);
    }
    return [...byChild.values()]
      .filter((d) => d.balance > 0.01)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);
  }

  async outstandingDebt(scope: TenantScope): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      select: { amount: true, discountAmount: true, paidAmount: true },
    });
    return invoices.reduce(
      (sum, inv) => sum + (Number(inv.amount) - Number(inv.discountAmount) - Number(inv.paidAmount)),
      0,
    );
  }

  /**
   * Tarmoq bo'ylab moliya jamlanmasi: umumiy hisoblangan/yig'ilgan/qarz,
   * filial va guruh kesimida. Guruh kesimi uchun `groupBy` ishlatib
   * bo'lmaydi — Invoice'da groupId yo'q va Prisma bog'lanish maydoni bo'yicha
   * guruhlay olmaydi, shuning uchun bolaning guruhi bilan birga o'qib,
   * yig'indi JS tomonda chiqariladi.
   */
  async networkSummary(scope: TenantScope, query: FinanceSummaryQueryDto) {
    assertFinanceReader(scope);
    const period = query.period ?? currentPeriodString();
    const branchId = scope.branchId ?? query.branchId;

    const [invoices, branches, groups, collectedThisPeriod, byMethodGrouped] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId: scope.organizationId, branchId, period },
        select: {
          amount: true,
          discountAmount: true,
          paidAmount: true,
          status: true,
          branchId: true,
          child: { select: { groupId: true } },
        },
      }),
      this.prisma.branch.findMany({
        where: { organizationId: scope.organizationId, ...(branchId ? { id: branchId } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.group.findMany({
        where: { branch: { organizationId: scope.organizationId }, ...(branchId ? { branchId } : {}) },
        select: { id: true, name: true, branchId: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId: scope.organizationId,
          branchId,
          status: "COMPLETED",
          ...periodRange(period),
        },
        _sum: { amount: true },
      }),
      // Naqd vs o'tkazma bo'linishi — kassani solishtirish uchun.
      this.prisma.payment.groupBy({
        by: ["method"],
        where: {
          organizationId: scope.organizationId,
          branchId,
          status: "COMPLETED",
          ...periodRange(period),
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const byMethod = { CASH: { amount: 0, count: 0 }, BANK_TRANSFER: { amount: 0, count: 0 } };
    for (const row of byMethodGrouped) {
      byMethod[row.method] = { amount: Number(row._sum.amount ?? 0), count: row._count._all };
    }

    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    const groupInfo = new Map(groups.map((g) => [g.id, g]));

    const totals = emptyBucket();
    const perBranch = new Map<string, Bucket>();
    const perGroup = new Map<string, Bucket>();
    const perStatus = new Map<string, { count: number; billed: number; paid: number }>();

    for (const invoice of invoices) {
      const billed = toMinor(invoice.amount) - toMinor(invoice.discountAmount);
      const paid = toMinor(invoice.paidAmount);
      addTo(totals, billed, paid);
      addTo(getBucket(perBranch, invoice.branchId), billed, paid);
      // Guruhsiz bolalar alohida "" kalitida yig'iladi
      addTo(getBucket(perGroup, invoice.child.groupId ?? ""), billed, paid);

      const status = perStatus.get(invoice.status) ?? { count: 0, billed: 0, paid: 0 };
      status.count += 1;
      status.billed += billed;
      status.paid += paid;
      perStatus.set(invoice.status, status);
    }

    return {
      period,
      totals: {
        ...bucketToMajor(totals),
        // Shu davrda kassaga tushgan pul (to'lov sanasi bo'yicha) — bu
        // hisoblangan summadan farq qiladi: avvalgi oy qarzi ham tushishi mumkin.
        collectedInPeriod: Number(collectedThisPeriod._sum.amount ?? 0),
        invoiceCount: invoices.length,
      },
      byMethod,
      branches: branches.map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        ...bucketToMajor(perBranch.get(branch.id) ?? emptyBucket()),
      })),
      groups: [
        ...groups.map((group) => ({
          groupId: group.id,
          groupName: group.name,
          branchId: group.branchId,
          branchName: branchName.get(group.branchId) ?? "",
          ...bucketToMajor(perGroup.get(group.id) ?? emptyBucket()),
        })),
        ...(perGroup.has("")
          ? [
              {
                groupId: null,
                groupName: "Guruhga biriktirilmagan",
                branchId: null,
                branchName: "",
                ...bucketToMajor(perGroup.get("")!),
              },
            ]
          : []),
      ],
      statuses: [...perStatus.entries()].map(([status, value]) => ({
        status,
        count: value.count,
        billed: value.billed / 100,
        paid: value.paid / 100,
      })),
    };
  }

  /** Bola kesimida to'lov holati: kim to'lagan, kim to'lamagan. */
  async networkChildren(scope: TenantScope, query: FinanceChildrenQueryDto) {
    assertFinanceReader(scope);
    const period = query.period ?? currentPeriodString();
    const branchId = scope.branchId ?? query.branchId;

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId,
        period,
        ...(query.groupId ? { child: { groupId: query.groupId } } : {}),
      },
      select: {
        amount: true,
        discountAmount: true,
        paidAmount: true,
        dueDate: true,
        branchId: true,
        child: {
          select: {
            id: true,
            publicId: true,
            fullName: true,
            group: { select: { id: true, name: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byChild = new Map<
      string,
      {
        childId: string;
        publicId: number;
        fullName: string;
        groupId: string | null;
        groupName: string | null;
        branchId: string;
        branchName: string;
        billedMinor: number;
        paidMinor: number;
        dueDate: Date | null;
      }
    >();

    for (const invoice of invoices) {
      const key = invoice.child.id;
      const row =
        byChild.get(key) ??
        {
          childId: invoice.child.id,
          publicId: invoice.child.publicId,
          fullName: invoice.child.fullName,
          groupId: invoice.child.group?.id ?? null,
          groupName: invoice.child.group?.name ?? null,
          branchId: invoice.branch.id,
          branchName: invoice.branch.name,
          billedMinor: 0,
          paidMinor: 0,
          dueDate: null as Date | null,
        };
      row.billedMinor += toMinor(invoice.amount) - toMinor(invoice.discountAmount);
      row.paidMinor += toMinor(invoice.paidAmount);
      // Eng erta muddat ko'rsatiladi — kechikish shundan hisoblanadi
      if (!row.dueDate || invoice.dueDate < row.dueDate) {
        row.dueDate = invoice.dueDate;
      }
      byChild.set(key, row);
    }

    const now = new Date();
    let items = [...byChild.values()].map((row) => {
      const outstandingMinor = row.billedMinor - row.paidMinor;
      // InvoiceStatus.OVERDUE ni hech kim yozmaydi, shuning uchun kechikish
      // muddat sanasidan hisoblanadi, statusdan emas.
      const status: "PAID" | "PARTIAL" | "UNPAID" =
        outstandingMinor <= 0 ? "PAID" : row.paidMinor > 0 ? "PARTIAL" : "UNPAID";
      return {
        childId: row.childId,
        publicId: row.publicId,
        fullName: row.fullName,
        groupId: row.groupId,
        groupName: row.groupName,
        branchId: row.branchId,
        branchName: row.branchName,
        billed: row.billedMinor / 100,
        paid: row.paidMinor / 100,
        outstanding: Math.max(0, outstandingMinor) / 100,
        status,
        dueDate: row.dueDate,
        overdue: outstandingMinor > 0 && !!row.dueDate && row.dueDate < now,
      };
    });

    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }
    if (query.search) {
      const term = query.search.trim().toLowerCase().replace(/^id/, "");
      items = items.filter(
        (item) => item.fullName.toLowerCase().includes(term) || String(item.publicId).includes(term),
      );
    }
    items.sort((a, b) => b.outstanding - a.outstanding || a.fullName.localeCompare(b.fullName, "uz"));

    const counts = { total: byChild.size, paid: 0, partial: 0, unpaid: 0 };
    for (const row of byChild.values()) {
      const outstanding = row.billedMinor - row.paidMinor;
      if (outstanding <= 0) counts.paid += 1;
      else if (row.paidMinor > 0) counts.partial += 1;
      else counts.unpaid += 1;
    }

    return { period, counts, items };
  }
}

interface Bucket {
  billed: number;
  paid: number;
}

function emptyBucket(): Bucket {
  return { billed: 0, paid: 0 };
}

function getBucket(map: Map<string, Bucket>, key: string): Bucket {
  const existing = map.get(key);
  if (existing) return existing;
  const fresh = emptyBucket();
  map.set(key, fresh);
  return fresh;
}

function addTo(bucket: Bucket, billed: number, paid: number) {
  bucket.billed += billed;
  bucket.paid += paid;
}

/**
 * Pul tiyin (butun son) sifatida yig'iladi: Decimal(12,2) qiymatlarini
 * suzuvchi nuqtada qo'shsak, ko'p qatorda tiyinlar surilib ketadi.
 */
function toMinor(value: Prisma.Decimal | number | null | undefined): number {
  return Math.round(Number(value ?? 0) * 100);
}

function bucketToMajor(bucket: Bucket) {
  return {
    billed: bucket.billed / 100,
    collected: bucket.paid / 100,
    outstanding: Math.max(0, bucket.billed - bucket.paid) / 100,
  };
}

/**
 * Moliya hisobotlarini Super Admin, filial admini va moliyachi ko'radi.
 * `requireMoneyScope` bu yerda ishlatilmaydi: u avval `requireBranchScope` ni
 * chaqiradi va filialsiz Super Adminni rad etadi — ya'ni hisobotni aynan
 * ko'rishi kerak bo'lgan rol uchun 403 qaytarardi.
 */
/**
 * Filial darajasidagi moliya ma'lumotlarini (hisob-fakturalar, to'lovlar,
 * bola tarixi, PDF) o'qish huquqi — `requireMoneyScope` bilan bir xil rol
 * to'plami (yozish huquqiga ega bo'lganlar o'qiy ham oladi), faqat bu yerda
 * filial talab qilinmaydi — Super Admin `branchId` so'rov parametri orqali
 * istalgan filialni ko'radi. O'qituvchi — yagona butunlay man etilgan rol.
 */
export function assertMoneyReader(scope: TenantScope) {
  if (scope.role === "TEACHER") {
    throw new ForbiddenException("O'qituvchi moliya bo'limlarida ishlay olmaydi");
  }
}

function assertFinanceReader(scope: TenantScope) {
  if (scope.role !== "NETWORK_ADMIN" && scope.role !== "BRANCH_ADMIN" && scope.role !== "FINANCE") {
    throw new ForbiddenException("Bu bo'limni faqat Super Admin, filial admini va moliyachi ko'ra oladi");
  }
}

function currentPeriodString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

/** "2026-09" -> shu oyning Toshkent vaqti bo'yicha UTC chegaralari. */
function periodRange(period: string): { createdAt: { gte: Date; lt: Date } } {
  const [year, month] = period.split("-").map(Number);
  const offsetMs = DEFAULT_TIMEZONE_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  return {
    createdAt: {
      gte: new Date(Date.UTC(year, month - 1, 1) - offsetMs),
      lt: new Date(Date.UTC(year, month, 1) - offsetMs),
    },
  };
}

const DEFAULT_TIMEZONE_UTC_OFFSET_HOURS = 5; // Asia/Tashkent, fixed offset (no DST)

function currentMonthRange(): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const offsetMs = DEFAULT_TIMEZONE_UTC_OFFSET_HOURS * 60 * 60 * 1000;

  const start = new Date(Date.UTC(year, month - 1, 1) - offsetMs);
  const end = new Date(Date.UTC(year, month, 1) - offsetMs);
  return { start, end };
}

function previousMonthRange(): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const offsetMs = DEFAULT_TIMEZONE_UTC_OFFSET_HOURS * 60 * 60 * 1000;

  const start = new Date(Date.UTC(year, month - 2, 1) - offsetMs);
  const end = new Date(Date.UTC(year, month - 1, 1) - offsetMs);
  return { start, end };
}
