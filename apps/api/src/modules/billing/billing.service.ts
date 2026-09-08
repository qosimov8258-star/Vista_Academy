import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireMoneyScope } from "../iam/tenant-auth.types";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";

const EPSILON = 0.01;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scope: TenantScope, dto: CreateInvoiceDto) {
    const branchId = requireMoneyScope(scope);
    const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } });
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
          currency: dto.currency ?? "UZS",
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
    });
  }

  async findAll(scope: TenantScope, query: InvoiceQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.childId ? { childId: query.childId } : {}),
      ...(query.status ? { status: query.status } : {}),
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

    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  async recordPayment(scope: TenantScope, recordedByUserId: string, dto: RecordPaymentDto) {
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
    });
  }

  async refundPayment(scope: TenantScope, paymentId: string) {
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
    });
  }

  async findPayments(scope: TenantScope, query: PaymentQueryDto) {
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
