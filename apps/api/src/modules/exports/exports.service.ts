import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { formatChildPublicId } from "../children/child-creation";
import { assertMoneyReader } from "../billing/billing.service";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Naqd",
  BANK_TRANSFER: "Bank o'tkazmasi",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Kutilmoqda",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  OVERDUE: "Muddati o'tgan",
  CANCELLED: "Bekor qilingan",
};

function formatMoney(value: unknown, currency: string): string {
  return `${Number(value).toLocaleString("uz-UZ")} ${currency}`;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async childrenCsv(scope: TenantScope, branchId?: string): Promise<string> {
    const children = await this.prisma.child.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? branchId },
      include: {
        branch: { select: { name: true } },
        group: { select: { name: true } },
        guardians: {
          orderBy: { isPrimary: "desc" },
          take: 1,
          include: { guardian: { select: { fullName: true, phone: true } } },
        },
      },
      orderBy: { fullName: "asc" },
    });
    return toCsv(
      [
        "ID",
        "To'liq ism",
        "Tug'ilgan sana",
        "Ota-ona",
        "Telefon",
        "Filial",
        "Guruh",
        "Holat",
        "Ro'yxatga olingan sana",
      ],
      children.map((c) => [
        formatChildPublicId(c.publicId),
        c.fullName,
        c.birthDate ? c.birthDate.toISOString().slice(0, 10) : "",
        c.guardians[0]?.guardian.fullName ?? "",
        c.guardians[0]?.guardian.phone ?? "",
        c.branch?.name ?? "",
        c.group?.name ?? "",
        c.status,
        c.createdAt.toISOString().slice(0, 10),
      ]),
    );
  }

  async invoicesCsv(scope: TenantScope, branchId?: string, period?: string): Promise<string> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? branchId,
        ...(period ? { period } : {}),
      },
      include: { child: { select: { fullName: true } } },
      orderBy: { dueDate: "desc" },
    });
    return toCsv(
      ["Bola", "Davr", "Summa", "Chegirma", "To'langan", "Valyuta", "Muddat", "Holat", "To'langan sana"],
      invoices.map((i) => [
        i.child?.fullName ?? "",
        i.period,
        i.amount.toString(),
        i.discountAmount.toString(),
        i.paidAmount.toString(),
        i.currency,
        i.dueDate.toISOString().slice(0, 10),
        i.status,
        i.paidAt ? i.paidAt.toISOString().slice(0, 10) : "",
      ]),
    );
  }

  async leadsCsv(scope: TenantScope, branchId?: string): Promise<string> {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? branchId },
      include: { assignedTo: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return toCsv(
      ["Bola", "Ota-ona", "Telefon", "Manba", "Bosqich", "Mas'ul", "Yo'qotish sababi", "Yaratilgan sana"],
      leads.map((l) => [
        l.childFullName,
        l.parentName,
        l.parentPhone,
        l.source,
        l.stage,
        l.assignedTo?.fullName ?? "",
        l.lostReason ?? "",
        l.createdAt.toISOString().slice(0, 10),
      ]),
    );
  }

  /**
   * `from`/`to` berilsa — sana oralig'i (har kun uchun alohida qatorlar),
   * bo'lmasa — faqat `date` kuni (eski, bitta kunlik chaqiruvlar bilan
   * moslik uchun).
   */
  async attendanceCsv(scope: TenantScope, date: string, branchId?: string, from?: string, to?: string): Promise<string> {
    const resolvedBranchId = scope.branchId ?? branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: resolvedBranchId, organizationId: scope.organizationId },
    });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }

    const fromDate = from ? toDateOnly(from) : null;
    const toDate = to ? toDateOnly(to) : null;
    if (!fromDate !== !toDate) {
      throw new BadRequestException("Sana oralig'i uchun ham \"dan\", ham \"gacha\" kerak");
    }
    if (!fromDate && !date) {
      throw new BadRequestException("Sanani tanlang");
    }
    if (fromDate && toDate) {
      if (fromDate > toDate) {
        throw new BadRequestException("Boshlanish sanasi tugash sanasidan keyin bo'lishi mumkin emas");
      }
      const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
      if (dayCount > 366) {
        throw new BadRequestException("Oraliq 366 kundan uzun bo'lmasligi kerak");
      }
    }

    const children = await this.prisma.child.findMany({
      where: { branchId: resolvedBranchId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });

    if (fromDate && toDate) {
      const records = await this.prisma.attendance.findMany({
        where: { branchId: resolvedBranchId, date: { gte: fromDate, lte: toDate } },
      });
      const byChildDate = new Map(records.map((r) => [`${r.childId}_${r.date.toISOString().slice(0, 10)}`, r]));
      const rows: unknown[][] = [];
      for (let cursor = fromDate; cursor <= toDate; cursor = new Date(cursor.getTime() + 86_400_000)) {
        const dayKey = cursor.toISOString().slice(0, 10);
        for (const c of children) {
          const record = byChildDate.get(`${c.id}_${dayKey}`);
          rows.push([dayKey, c.fullName, record?.status ?? "BELGILANMAGAN", record?.note ?? ""]);
        }
      }
      return toCsv(["Sana", "To'liq ism", "Holat", "Izoh"], rows);
    }

    const day = toDateOnly(date);
    const records = await this.prisma.attendance.findMany({ where: { branchId: resolvedBranchId, date: day } });
    const byChild = new Map(records.map((r) => [r.childId, r]));
    return toCsv(
      ["Sana", "To'liq ism", "Holat", "Izoh"],
      children.map((c) => [
        date,
        c.fullName,
        byChild.get(c.id)?.status ?? "BELGILANMAGAN",
        byChild.get(c.id)?.note ?? "",
      ]),
    );
  }

  /** Haftalik menyuni chop etish/ota-onalarga ulashish uchun CSV. */
  async menuCsv(scope: TenantScope, from: string, to: string, branchId?: string): Promise<string> {
    if (!from || !to) {
      throw new BadRequestException("Sana oralig'ini tanlang");
    }
    const resolvedBranchId = scope.branchId ?? branchId;
    if (!resolvedBranchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: resolvedBranchId, organizationId: scope.organizationId },
    });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    const entries = await this.prisma.menuEntry.findMany({
      where: { branchId: resolvedBranchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      orderBy: { date: "asc" },
    });
    return toCsv(
      ["Sana", "Nonushta", "Tushlik", "Kechki ovqat / gazak"],
      entries.map((e) => [e.date.toISOString().slice(0, 10), e.breakfast ?? "", e.lunch ?? "", e.snack ?? ""]),
    );
  }

  /** Bitta hisob-fakturani ota-onaga ko'rsatish/chop etish uchun PDF qilib chiqaradi. */
  async invoicePdf(scope: TenantScope, invoiceId: string): Promise<Buffer> {
    assertMoneyReader(scope);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: scope.organizationId },
      include: {
        organization: { select: { name: true } },
        branch: { select: { name: true, address: true } },
        child: { select: { fullName: true, publicId: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException("Hisob-faktura topilmadi");
    }
    if (scope.branchId && invoice.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu hisob-fakturaga kirish huquqingiz yo'q");
    }

    const net = Number(invoice.amount) - Number(invoice.discountAmount);
    const remaining = net - Number(invoice.paidAmount);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text(invoice.organization.name, { align: "left" });
    doc.fontSize(11).fillColor("#555").text(invoice.branch.name);
    if (invoice.branch.address) doc.text(invoice.branch.address);
    doc.moveDown(1.5);

    doc.fillColor("#000").fontSize(16).text("Hisob-faktura", { align: "left" });
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#000");
    const row = (label: string, value: string) => {
      doc.text(`${label}: ${value}`);
      doc.moveDown(0.3);
    };
    row("Bola", `${invoice.child.fullName} (${formatChildPublicId(invoice.child.publicId)})`);
    row("Davr", invoice.period);
    row("Summa", formatMoney(invoice.amount, invoice.currency));
    if (Number(invoice.discountAmount) > 0) row("Chegirma", formatMoney(invoice.discountAmount, invoice.currency));
    row("To'langan", formatMoney(invoice.paidAmount, invoice.currency));
    row("Qoldiq", formatMoney(remaining, invoice.currency));
    row("Muddat", invoice.dueDate.toISOString().slice(0, 10));
    row("Holat", INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status);

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#888").text(`Chop etilgan sana: ${new Date().toISOString().slice(0, 10)}`);

    doc.end();
    return done;
  }

  /** Naqd/o'tkazma to'lov qabul qilingach ota-onaga beriladigan qog'oz tasdiqnoma. */
  async paymentReceiptPdf(scope: TenantScope, paymentId: string): Promise<Buffer> {
    assertMoneyReader(scope);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: scope.organizationId },
      include: {
        organization: { select: { name: true } },
        branch: { select: { name: true, address: true } },
        child: { select: { fullName: true, publicId: true } },
        recordedBy: { select: { fullName: true } },
        allocations: { include: { invoice: { select: { period: true } } } },
      },
    });
    if (!payment) {
      throw new NotFoundException("To'lov topilmadi");
    }
    if (scope.branchId && payment.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu to'lovga kirish huquqingiz yo'q");
    }

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text(payment.organization.name, { align: "left" });
    doc.fontSize(11).fillColor("#555").text(payment.branch.name);
    if (payment.branch.address) doc.text(payment.branch.address);
    doc.moveDown(1.5);

    doc
      .fillColor("#000")
      .fontSize(16)
      .text(payment.status === "REFUNDED" ? "To'lov kvitansiyasi (qaytarilgan)" : "To'lov kvitansiyasi", {
        align: "left",
      });
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#000");
    const row = (label: string, value: string) => {
      doc.text(`${label}: ${value}`);
      doc.moveDown(0.3);
    };
    row("Bola", `${payment.child.fullName} (${formatChildPublicId(payment.child.publicId)})`);
    row("Summa", formatMoney(payment.amount, payment.currency));
    row("To'lov turi", PAYMENT_METHOD_LABEL[payment.method] ?? payment.method);
    const periods = payment.allocations.map((a) => a.invoice.period);
    if (periods.length > 0) row("Davr", periods.join(", "));
    row("Sana", payment.createdAt.toISOString().slice(0, 10));
    if (payment.recordedBy) row("Qabul qildi", payment.recordedBy.fullName);
    if (payment.note) row("Izoh", payment.note);
    if (payment.status === "REFUNDED" && payment.refundedAt) {
      row("Qaytarilgan sana", payment.refundedAt.toISOString().slice(0, 10));
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#888").text(`Chop etilgan sana: ${new Date().toISOString().slice(0, 10)}`);

    doc.end();
    return done;
  }
}
