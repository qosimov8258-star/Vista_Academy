import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { formatChildPublicId } from "../children/child-creation";

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

  async attendanceCsv(scope: TenantScope, date: string, branchId?: string): Promise<string> {
    if (!date) {
      throw new BadRequestException("Sanani tanlang");
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
    const day = toDateOnly(date);
    const [children, records] = await Promise.all([
      this.prisma.child.findMany({
        where: { branchId: resolvedBranchId, status: "ACTIVE" },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
      this.prisma.attendance.findMany({ where: { branchId: resolvedBranchId, date: day } }),
    ]);
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
}
