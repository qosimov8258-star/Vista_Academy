import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  TenantAuthenticatedUser,
  TenantScope,
  requireMoneyScope,
  resolveReadBranchFilter,
  toTenantScope,
} from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { BulkCreateInvoiceDto } from "./dto/bulk-create-invoice.dto";
import { monthlyFeeOf } from "./monthly-fee";
import { discountFor } from "../discounts/discount-rules";
import { discountRuleSelect } from "../discounts/discount-invoices";
import { InvoiceQueryDto } from "./dto/invoice-query.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";
import { FinanceChildrenQueryDto, FinanceSummaryQueryDto } from "./dto/finance-query.dto";
import { AcceptPaymentDto, RefundPaymentDto } from "./dto/accept-payment.dto";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";

const EPSILON = 0.01;
/** Ekrandan olingan skrinshotlar ham sig'sin — ota-ona cheki bilan bir xil chegara. */
const MAX_RECEIPT_IMAGE_BYTES = 3 * 1024 * 1024;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
/** Amallar jurnali uchun usul nomi */
const METHOD_UZ: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  BANK_TRANSFER: "O'tkazma",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  MOBILE_APP: "Ilova",
  BANKOMAT: "Bankomat",
  OTHER: "Boshqa",
};

/** To'lovlar ro'yxati uchun: chek rasmi baytlari (`receiptImage`) har qatorda tortilmasin. */
const paymentListSelect = {
  id: true,
  childId: true,
  amount: true,
  currency: true,
  method: true,
  status: true,
  note: true,
  refundedAt: true,
  refundReason: true,
  refundedByName: true,
  createdAt: true,
  receiptMimeType: true,
  child: { select: { id: true, fullName: true } },
  recordedBy: { select: { fullName: true } },
  allocations: { select: { amount: true, invoice: { select: { id: true, period: true } } } },
} satisfies Prisma.PaymentSelect;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly r2: R2Service,
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

    // Chegirma qo'lda berilmasa — bolaning shu oydagi chegirma qoidasidan
    const fromRule = dto.discountAmount === undefined;
    const discountAmount = fromRule
      ? discountFor(await this.prisma.childDiscount.findMany({ where: { childId: child.id }, select: discountRuleSelect }), dto.period, dto.amount)
      : dto.discountAmount!;
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
            note: fromRule ? `Chegirma — ${dto.period}` : "Chegirma",
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

    const [children, branch] = await Promise.all([
      this.prisma.child.findMany({
        where: {
          branchId,
          status: "ACTIVE",
          ...(dto.groupId ? { groupId: dto.groupId } : {}),
        },
        select: { id: true, group: { select: { monthlyFee: true } } },
      }),
      this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { defaultTuitionAmount: true } }),
    ]);
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

    // Summa berilmasa — har bola o'z guruhi narxida (bo'lmasa filial narxi);
    // narxi umuman yo'q bola tashlab ketiladi va alohida sanaladi.
    const created = [];
    let noFeeCount = 0;
    for (const child of targets) {
      const amount = dto.amount ?? monthlyFeeOf(child.group, branch);
      if (!amount || amount <= 0) {
        noFeeCount += 1;
        continue;
      }
      if ((dto.discountAmount ?? 0) > amount) {
        throw new BadRequestException("Chegirma summadan katta bo'lishi mumkin emas");
      }
      created.push(
        await this.create(caller, {
          childId: child.id,
          amount,
          discountAmount: dto.discountAmount,
          period: dto.period,
          dueDate: dto.dueDate,
        }),
      );
    }

    return { createdCount: created.length, skippedCount: children.length - targets.length, noFeeCount };
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

  /**
   * Kassada bola bo'yicha to'lov qabul qilish — bitta so'rovda va bitta
   * tranzaksiyada:
   *  - summa ochiq hisob-fakturalarni eng eski oydan boshlab yopadi (bir
   *    to'lov bir necha oy qarzini yopishi mumkin);
   *  - qarz yo'q bo'lsa — `period` oyi uchun oldindan to'lov: o'sha oy uchun
   *    hisob-faktura yo'q bo'lsagina yaratiladi (ikki marta yozilmasin);
   *  - naqddan boshqa usulda chek surati majburiy va to'lov bilan birga
   *    saqlanadi (to'lov cheksiz qolib ketmasin).
   */
  async acceptPayment(caller: TenantAuthenticatedUser, dto: AcceptPaymentDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const amount = Math.round(dto.amount * 100) / 100;
    const note = dto.note?.trim() || undefined;

    const [child, branch] = await Promise.all([
      this.prisma.child.findFirst({
        where: { id: dto.childId, organizationId: scope.organizationId },
        select: { id: true, fullName: true, branchId: true, group: { select: { monthlyFee: true } } },
      }),
      this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { currency: true, defaultTuitionAmount: true } }),
    ]);
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bola boshqa filialda — to'lovni o'sha filial kassasi qabul qiladi");
    }
    if (dto.method !== "CASH" && !dto.receiptImage) {
      throw new BadRequestException("Naqddan boshqa usulda chek surati majburiy");
    }
    if (dto.method === "CASH" && dto.receiptImage) {
      throw new BadRequestException("Naqd to'lovga chek surati biriktirilmaydi");
    }

    const openInvoices = (
      await this.prisma.invoice.findMany({
        where: { childId: child.id, branchId, status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } },
        orderBy: [{ period: "asc" }, { dueDate: "asc" }],
      })
    ).filter((i) => Number(i.amount) - Number(i.discountAmount) - Number(i.paidAmount) > EPSILON);
    const totalDebt = openInvoices.reduce((s, i) => s + Number(i.amount) - Number(i.discountAmount) - Number(i.paidAmount), 0);

    let advancePeriod: string | null = null;
    if (totalDebt > EPSILON) {
      if (amount > totalDebt + EPSILON) {
        throw new BadRequestException(`Qolgan qarz ${formatSum(totalDebt)} so'm — undan ko'p qabul qilib bo'lmaydi`);
      }
    } else {
      if (!dto.period) {
        throw new BadRequestException("Qarz yo'q — oldindan to'lov uchun oyni tanlang");
      }
      const existing = await this.prisma.invoice.findFirst({
        where: { childId: child.id, period: dto.period, status: { not: InvoiceStatus.CANCELLED } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(`${dto.period} oyi allaqachon to'langan — boshqa oyni tanlang`);
      }
      advancePeriod = dto.period;
    }

    // Rasm tranzaksiyadan oldin tayyorlanadi: R2 ga yuklash bazaga yozishdan
    // oldin bo'ladi, xato chiqsa to'lov umuman yozilmaydi.
    let receipt: { image: Buffer<ArrayBuffer> | null; key: string | null; mimeType: string } | null = null;
    if (dto.receiptImage) {
      const { buffer, mimeType } = decodeReceiptImage(dto.receiptImage);
      receipt = { image: buffer, key: null, mimeType };
      if (this.r2.enabled) {
        receipt.key = this.r2.buildKey(scope.organizationId, R2_CATEGORY.PAYMENT_RECEIPT);
        await this.r2.uploadBuffer(receipt.key, buffer, mimeType);
        receipt.image = null;
      }
    }

    // Oy to'lovi bolaning oylik narxidan (guruh narxi, bo'lmasa filial narxi)
    // kam bo'lmaydi — qisman oldindan to'langan oyning qolgani qarz bo'lib ko'rinsin.
    // Shu oy uchun chegirma qoidasi bo'lsa — hisob-fakturaga chegirma bilan yoziladi.
    const advanceFee = advancePeriod ? monthlyFeeOf(child.group, branch) : 0;
    const advanceDiscount = advancePeriod
      ? discountFor(await this.prisma.childDiscount.findMany({ where: { childId: child.id }, select: discountRuleSelect }), advancePeriod, advanceFee)
      : 0;
    const advanceAmount = advancePeriod ? Math.max(amount + advanceDiscount, advanceFee) : 0;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const targets = [...openInvoices];
        if (advancePeriod) {
          const invoiceAmount = advanceAmount;
          const invoice = await tx.invoice.create({
            data: {
              organizationId: scope.organizationId,
              branchId,
              childId: child.id,
              amount: invoiceAmount,
              discountAmount: advanceDiscount,
              currency: branch.currency,
              period: advancePeriod,
              dueDate: todayTashkentDate(),
            },
          });
          await tx.ledgerEntry.create({
            data: {
              organizationId: scope.organizationId,
              branchId,
              childId: child.id,
              type: "CHARGE",
              amount: invoiceAmount,
              invoiceId: invoice.id,
              note: `Hisob-faktura — ${advancePeriod} (oldindan to'lov)`,
            },
          });
          if (advanceDiscount > 0) {
            await tx.ledgerEntry.create({
              data: {
                organizationId: scope.organizationId,
                branchId,
                childId: child.id,
                type: "DISCOUNT",
                amount: -advanceDiscount,
                invoiceId: invoice.id,
                note: `Chegirma — ${advancePeriod}`,
              },
            });
          }
          targets.push(invoice);
        }

        const payment = await tx.payment.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            childId: child.id,
            amount,
            currency: targets[0]?.currency ?? branch.currency,
            method: dto.method,
            note,
            recordedByUserId: caller.id,
            receiptImage: receipt?.image ?? null,
            receiptImageKey: receipt?.key ?? null,
            receiptMimeType: receipt?.mimeType ?? null,
          },
        });

        let left = amount;
        const allocations: { invoiceId: string; period: string; amount: number; closed: boolean }[] = [];
        for (const invoice of targets) {
          if (left <= EPSILON) break;
          const netPayable = Number(invoice.amount) - Number(invoice.discountAmount);
          const remaining = netPayable - Number(invoice.paidAmount);
          const part = Math.min(left, remaining);
          if (part <= EPSILON) continue;
          left -= part;
          const newPaidAmount = Number(invoice.paidAmount) + part;
          const isFullyPaid = newPaidAmount >= netPayable - EPSILON;
          await tx.paymentAllocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, amount: part } });
          await tx.invoice.update({
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
              childId: child.id,
              type: "PAYMENT",
              amount: -part,
              invoiceId: invoice.id,
              paymentId: payment.id,
              note: `To'lov (${dto.method}) — ${invoice.period}`,
            },
          });
          allocations.push({ invoiceId: invoice.id, period: invoice.period, amount: part, closed: isFullyPaid });
        }

        return { payment, allocations };
      });

      const remainingDebt = Math.max(0, totalDebt - amount);
      await this.auditLog.logFromUser(caller, {
        action: "payment.record",
        entityType: "Payment",
        entityId: result.payment.id,
        branchId,
        summary: `${child.fullName}: ${formatSum(amount)} so'm to'lov qabul qilindi (${METHOD_UZ[dto.method] ?? dto.method}; ${result.allocations
          .map((a) => a.period)
          .join(", ")})`,
      });
      const { receiptImage: _image, ...payment } = result.payment;
      return {
        payment: { ...payment, hasReceiptImage: receipt !== null },
        allocations: result.allocations,
        advancePeriod,
        remainingDebt: advancePeriod ? Math.max(0, advanceAmount - advanceDiscount - amount) : remainingDebt,
      };
    } catch (error) {
      if (receipt?.key) {
        await this.r2.deleteObject(receipt.key).catch(() => undefined);
      }
      throw error;
    }
  }

  /**
   * To'lovni bekor qilish (qaytarish) — sabab majburiy. To'lov o'chirilmaydi:
   * holati REFUNDED bo'ladi, sabab va kim bekor qilgani to'lovning o'zida,
   * ledgerda va amallar jurnalida (kimning, qancha, qaysi oylar) qoladi.
   */
  async refundPayment(caller: TenantAuthenticatedUser, paymentId: string, dto: RefundPaymentDto) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    const reason = dto.reason?.trim() ?? "";
    if (reason.length < 3) {
      throw new BadRequestException("Bekor qilish sababini yozing (kamida 3 harf)");
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: scope.organizationId },
      include: { allocations: { include: { invoice: true } }, child: { select: { fullName: true } } },
    });
    if (!payment) {
      throw new NotFoundException("To'lov topilmadi");
    }
    if (payment.branchId !== branchId) {
      throw new ForbiddenException("Bu to'lovga kirish huquqingiz yo'q");
    }
    if (payment.status === "REFUNDED") {
      throw new BadRequestException("To'lov allaqachon bekor qilingan");
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
        data: { status: "REFUNDED", refundedAt: new Date(), refundReason: reason, refundedByName: caller.fullName },
        omit: { receiptImage: true },
      });

      await tx.ledgerEntry.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childId: payment.childId,
          type: "REFUND",
          amount: Number(payment.amount),
          paymentId: payment.id,
          note: `To'lov bekor qilindi — ${reason}`,
        },
      });

      return updatedPayment;
    }).then(async (updatedPayment) => {
      const paidOn = new Date(payment.createdAt.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
      const periods = payment.allocations.map((a) => a.invoice.period).join(", ");
      await this.auditLog.logFromUser(caller, {
        action: "payment.refund",
        entityType: "Payment",
        entityId: updatedPayment.id,
        branchId,
        summary: `${payment.child.fullName}: ${formatSum(Number(payment.amount))} so'm to'lov bekor qilindi (${METHOD_UZ[payment.method] ?? payment.method}, ${paidOn}${periods ? `; ${periods}` : ""}). Sabab: ${reason}`,
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
        select: paymentListSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const data = items.map(({ receiptMimeType, recordedBy, allocations, ...item }) => ({
      ...item,
      hasReceiptImage: receiptMimeType !== null,
      recordedByName: recordedBy?.fullName ?? null,
      periods: allocations.map((a) => ({ invoiceId: a.invoice.id, period: a.invoice.period, amount: a.amount })),
    }));
    return { data, meta: { page: query.page, limit: query.limit, total } };
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

  /**
   * Muddatiga besh kun yoki undan kam qolgan (lekin hali o'tmagan)
   * fakturalar uchun `PAYMENT_DUE` bildirishnomasi — `syncOverdueNotifications`
   * bilan bir xil naqsh: bola boshiga kuniga bittadan, muddat kuni o'zi esa
   * darhol `PAYMENT_OVERDUE` ga o'tadi (yuqoriga qarang), shuning uchun bu
   * yerda qatnashmaydi.
   */
  async syncPaymentDueNotifications(scope: TenantScope): Promise<void> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const dueSoon = await this.prisma.invoice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] },
        dueDate: { gt: now, lte: horizon },
      },
      select: { branchId: true, childId: true, dueDate: true, child: { select: { fullName: true } } },
    });
    if (dueSoon.length === 0) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyNotified = await this.prisma.notificationLog.findMany({
      where: {
        childId: { in: dueSoon.map((invoice) => invoice.childId) },
        eventType: "PAYMENT_DUE",
        createdAt: { gte: todayStart },
      },
      select: { childId: true },
    });
    const notified = new Set(alreadyNotified.map((n) => n.childId));

    for (const invoice of dueSoon) {
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
        eventType: "PAYMENT_DUE",
        recipientName: link?.guardian.fullName ?? "Ota-ona",
        message: `${invoice.child.fullName} uchun to'lov muddati yaqinlashmoqda (${invoice.dueDate.toISOString().slice(0, 10)}).`,
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
    const branchId = resolveReadBranchFilter(scope, query.branchId);

    const [invoices, branches, groups, collectedThisPeriod, byMethodGrouped, periodPayments] = await Promise.all([
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
      // Haftalar bo'yicha to'lov tendensiyasi — bosh sahifadagi grafik uchun.
      this.prisma.payment.findMany({
        where: {
          organizationId: scope.organizationId,
          branchId,
          status: "COMPLETED",
          ...periodRange(period),
        },
        select: { amount: true, createdAt: true },
      }),
    ]);

    const byMethod = {
      CASH: { amount: 0, count: 0 },
      BANK_TRANSFER: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      CLICK: { amount: 0, count: 0 },
      PAYME: { amount: 0, count: 0 },
      UZUM: { amount: 0, count: 0 },
      MOBILE_APP: { amount: 0, count: 0 },
      BANKOMAT: { amount: 0, count: 0 },
      OTHER: { amount: 0, count: 0 },
    };
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
      weeklyPayments: buildWeeklyPayments(period, periodPayments),
    };
  }

  /** Bola kesimida to'lov holati: kim to'lagan, kim to'lamagan. */
  async networkChildren(scope: TenantScope, query: FinanceChildrenQueryDto) {
    assertFinanceReader(scope);
    const period = query.period ?? currentPeriodString();
    const branchId = resolveReadBranchFilter(scope, query.branchId);

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

export function currentPeriodString(): string {
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

function daysInPeriod(period: string): number {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function tashkentDayOfMonth(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", day: "2-digit" }).format(date));
}

/**
 * Oyni 7 kunlik haftalarga bo'lib, har biriga shu kunlarda tushgan to'lovlarni
 * yig'adi — bosh sahifadagi "haftalar bo'yicha to'lov" grafigi uchun.
 */
function buildWeeklyPayments(period: string, payments: { amount: Prisma.Decimal; createdAt: Date }[]) {
  const weekCount = Math.ceil(daysInPeriod(period) / 7);
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    week: i + 1,
    label: `${i + 1}-hafta`,
    amount: 0,
    count: 0,
  }));
  for (const payment of payments) {
    const day = tashkentDayOfMonth(payment.createdAt);
    const index = Math.min(weekCount - 1, Math.floor((day - 1) / 7));
    weeks[index].amount += Number(payment.amount);
    weeks[index].count += 1;
  }
  return weeks;
}

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

function formatSum(value: number): string {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(value).replace(/,/g, " ");
}

/** Bugungi Toshkent sanasi (UTC yarim tun) — `dueDate` uchun. */
function todayTashkentDate(): Date {
  const day = new Date(Date.now() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`);
}

export function decodeReceiptImage(dataUrl: string) {
  const [header, base64] = dataUrl.split(",", 2);
  const mimeType = header.slice("data:".length, header.indexOf(";"));
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) {
    throw new BadRequestException("Chek surati bo'sh");
  }
  if (buffer.byteLength > MAX_RECEIPT_IMAGE_BYTES) {
    throw new BadRequestException("Chek surati hajmi juda katta (3 MB gacha)");
  }
  return { buffer, mimeType };
}
