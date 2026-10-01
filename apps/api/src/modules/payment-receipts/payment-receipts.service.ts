import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireMoneyScope, toTenantScope } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { BillingService, assertMoneyReader } from "../billing/billing.service";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import { SubmitPaymentReceiptDto } from "./dto/submit-payment-receipt.dto";
import { ApprovePaymentReceiptDto } from "./dto/approve-payment-receipt.dto";
import { RejectPaymentReceiptDto } from "./dto/reject-payment-receipt.dto";

/** Ekrandan olingan skrinshotlar kattaroq bo'lishi mumkin — bola surati (600KB)dan farqli, 3MB gacha. */
const MAX_RECEIPT_IMAGE_BYTES = 3 * 1024 * 1024;
/** Bir bola uchun bir vaqtda ko'rib chiqilmagan cheklar — cheksiz yuklab xotirani to'ldirmaslik uchun. */
const MAX_PENDING_RECEIPTS_PER_CHILD = 5;

const receiptSummarySelect = {
  id: true,
  childId: true,
  guardianId: true,
  claimedAmount: true,
  currency: true,
  status: true,
  reviewNote: true,
  reviewedByUserId: true,
  reviewedAt: true,
  paymentId: true,
  createdAt: true,
} as const;

/**
 * Ota-ona kabinetidan yuklangan to'lov cheklari: yuklash/ko'rish (ota-ona
 * tomoni) va ko'rib chiqish/tasdiqlash (moliyachi tomoni). Tasdiqlash
 * `BillingService.recordPayment` orqali haqiqiy Payment+LedgerEntry
 * yaratadi — bu yerda pul hisobi qaytadan yozilmaydi.
 */
@Injectable()
export class PaymentReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly auditLog: AuditLogService,
    private readonly r2: R2Service,
  ) {}

  // ---------------------------------------------------------------
  // Ota-ona tomoni
  // ---------------------------------------------------------------

  private async assertParentOwnsChildWithFinance(parent: AuthenticatedParent, childId: string) {
    const link = await this.prisma.childGuardian.findFirst({
      where: { guardianId: parent.id, childId },
      select: {
        canViewFinance: true,
        child: { select: { id: true, organizationId: true, branchId: true } },
      },
    });
    if (!link || link.child.organizationId !== parent.organizationId) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (!link.canViewFinance) {
      throw new ForbiddenException("Sizga moliya bo'limiga kirish huquqi berilmagan");
    }
    return link.child;
  }

  private decodeImage(dataUrl: string) {
    const [header, base64] = dataUrl.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_RECEIPT_IMAGE_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }
    return { buffer, mimeType };
  }

  async submitForParent(parent: AuthenticatedParent, childId: string, dto: SubmitPaymentReceiptDto) {
    const child = await this.assertParentOwnsChildWithFinance(parent, childId);
    const pending = await this.prisma.paymentReceipt.count({ where: { childId: child.id, status: "PENDING" } });
    if (pending >= MAX_PENDING_RECEIPTS_PER_CHILD) {
      throw new BadRequestException("Ko'rib chiqilmagan cheklar ko'p — moliyachi ularni tekshirgach yangisini yuboring");
    }
    const { buffer, mimeType } = this.decodeImage(dto.image);

    let image: Buffer<ArrayBuffer> | null = buffer;
    let imageKey: string | null = null;
    if (this.r2.enabled) {
      imageKey = this.r2.buildKey(child.organizationId, R2_CATEGORY.PAYMENT_RECEIPT);
      await this.r2.uploadBuffer(imageKey, buffer, mimeType);
      image = null;
    }

    return this.prisma.paymentReceipt.create({
      data: {
        organizationId: child.organizationId,
        branchId: child.branchId,
        childId: child.id,
        guardianId: parent.id,
        claimedAmount: dto.amount,
        image,
        imageKey,
        mimeType,
      },
      select: receiptSummarySelect,
    });
  }

  async listForParent(parent: AuthenticatedParent, childId: string) {
    await this.assertParentOwnsChildWithFinance(parent, childId);
    return this.prisma.paymentReceipt.findMany({
      where: { childId, guardianId: parent.id },
      orderBy: { createdAt: "desc" },
      select: receiptSummarySelect,
    });
  }

  async readImageForParent(parent: AuthenticatedParent, receiptId: string) {
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: { id: receiptId, guardianId: parent.id },
      select: { image: true, imageKey: true, mimeType: true },
    });
    if (!receipt) {
      throw new NotFoundException("Chek topilmadi");
    }
    return receipt;
  }

  // ---------------------------------------------------------------
  // Xodim (moliyachi) tomoni
  // ---------------------------------------------------------------

  private async requireChildInScope(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, organizationId: scope.organizationId },
      select: { id: true, branchId: true },
    });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return child;
  }

  async listForChild(scope: TenantScope, childId: string) {
    assertMoneyReader(scope);
    await this.requireChildInScope(scope, childId);
    return this.prisma.paymentReceipt.findMany({
      where: { childId },
      orderBy: { createdAt: "desc" },
      select: { ...receiptSummarySelect, guardian: { select: { fullName: true } } },
    });
  }

  async readImageForStaff(scope: TenantScope, receiptId: string) {
    assertMoneyReader(scope);
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: { id: receiptId, organizationId: scope.organizationId },
      select: { image: true, imageKey: true, mimeType: true, branchId: true },
    });
    if (!receipt) {
      throw new NotFoundException("Chek topilmadi");
    }
    if (scope.branchId && receipt.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu chekka kirish huquqingiz yo'q");
    }
    return receipt;
  }

  private async loadPendingReceipt(scope: TenantScope, receiptId: string) {
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: { id: receiptId, organizationId: scope.organizationId },
    });
    if (!receipt) {
      throw new NotFoundException("Chek topilmadi");
    }
    if (scope.branchId && receipt.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu chekka kirish huquqingiz yo'q");
    }
    if (receipt.status !== "PENDING") {
      throw new BadRequestException("Bu chek allaqachon ko'rib chiqilgan");
    }
    return receipt;
  }

  async approve(caller: TenantAuthenticatedUser, receiptId: string, dto: ApprovePaymentReceiptDto) {
    const scope = toTenantScope(caller);
    requireMoneyScope(scope);
    const receipt = await this.loadPendingReceipt(scope, receiptId);

    // Chek qaysi hisob-fakturaga tegishli ekani ma'lum emas — ota-ona
    // eslatma kartasidagi qarzni ko'rib to'laydi, xuddi shu mantiq bilan
    // eng eski ochiq hisob-fakturani topamiz (ParentService.paymentReminder).
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        childId: receipt.childId,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      orderBy: { dueDate: "asc" },
    });
    if (!invoice) {
      throw new BadRequestException("Bu bola uchun ochiq hisob-faktura yo'q — to'lovni qabul qilib bo'lmaydi");
    }

    // Chekni avval atomar "egallab olamiz": ikki marta bosish yoki ikki moliyachi
    // bir vaqtda tasdiqlasa, faqat bittasi o'tadi — aks holda bitta chek uchun
    // ikkita to'lov yozilardi (PENDING tekshiruvi va to'lov alohida qadamlar edi).
    const claimed = await this.prisma.paymentReceipt.updateMany({
      where: { id: receipt.id, status: "PENDING" },
      data: { status: "APPROVED", reviewedByUserId: caller.id, reviewedAt: new Date(), reviewNote: dto.note ?? null },
    });
    if (claimed.count === 0) {
      throw new BadRequestException("Bu chek allaqachon ko'rib chiqilgan");
    }

    let result: Awaited<ReturnType<BillingService["recordPayment"]>>;
    try {
      result = await this.billingService.recordPayment(caller, {
        invoiceId: invoice.id,
        amount: Number(receipt.claimedAmount),
        method: dto.method,
        note: dto.note ?? "To'lov cheki tasdiqlandi",
      });
    } catch (err) {
      // To'lov yozilmadi — chek qayta ko'rib chiqilishi uchun PENDING ga qaytadi
      await this.prisma.paymentReceipt.update({
        where: { id: receipt.id },
        data: { status: "PENDING", reviewedByUserId: null, reviewedAt: null, reviewNote: null },
      });
      throw err;
    }

    const updated = await this.prisma.paymentReceipt.update({
      where: { id: receipt.id },
      data: { paymentId: result.payment.id },
      select: receiptSummarySelect,
    });

    await this.auditLog.logFromUser(caller, {
      action: "payment_receipt.approve",
      entityType: "PaymentReceipt",
      entityId: receipt.id,
      branchId: receipt.branchId,
      summary: `To'lov cheki tasdiqlandi (${dto.method}, ${receipt.claimedAmount} ${receipt.currency})`,
    });

    return { receipt: updated, payment: result.payment };
  }

  async reject(caller: TenantAuthenticatedUser, receiptId: string, dto: RejectPaymentReceiptDto) {
    const scope = toTenantScope(caller);
    requireMoneyScope(scope);
    const receipt = await this.loadPendingReceipt(scope, receiptId);

    // Tasdiqlash bilan bir vaqtda kelsa — faqat hali PENDING bo'lsa rad etiladi
    const claimed = await this.prisma.paymentReceipt.updateMany({
      where: { id: receipt.id, status: "PENDING" },
      data: { status: "REJECTED", reviewedByUserId: caller.id, reviewedAt: new Date(), reviewNote: dto.comment },
    });
    if (claimed.count === 0) {
      throw new BadRequestException("Bu chek allaqachon ko'rib chiqilgan");
    }
    const updated = await this.prisma.paymentReceipt.findUniqueOrThrow({
      where: { id: receipt.id },
      select: receiptSummarySelect,
    });

    await this.auditLog.logFromUser(caller, {
      action: "payment_receipt.reject",
      entityType: "PaymentReceipt",
      entityId: receipt.id,
      branchId: receipt.branchId,
      summary: `To'lov cheki rad etildi: ${dto.comment}`,
    });

    return updated;
  }
}
