import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireMoneyScope } from "../iam/tenant-auth.types";
import { CloseCashDto, CreateExpenseDto } from "./dto/cash-desk.dto";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_INVOICE = ["PENDING", "PARTIALLY_PAID", "OVERDUE"] as const;
const METHODS = ["CASH", "CARD", "BANK_TRANSFER"] as const;
type Method = (typeof METHODS)[number];

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Toshkent kalendar kunining UTC chegaralari — to'lovlar `createdAt` bo'yicha shu kunga tushadi. */
function dayRange(date: string) {
  const start = new Date(toDateOnly(date).getTime() - TASHKENT_OFFSET_MS);
  return { gte: start, lt: new Date(start.getTime() + DAY_MS) };
}

function assertDate(value: string | undefined, label = "Sana"): string {
  if (!value || !DATE_RE.test(value)) {
    throw new BadRequestException(`${label} noto'g'ri (YYYY-MM-DD)`);
  }
  return value;
}

function emptyByMethod() {
  return Object.fromEntries(METHODS.map((m) => [m, { count: 0, total: 0 }])) as Record<Method, { count: number; total: number }>;
}

@Injectable()
export class CashDeskService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kunlik kassa: kirim usullar bo'yicha, qaytarishlar, xarajatlar va kassada bo'lishi kerak naqd. */
  async day(scope: TenantScope, date: string) {
    const branchId = requireMoneyScope(scope);
    assertDate(date);
    const range = dayRange(date);
    const [payments, refunds, expenses, closing] = await Promise.all([
      this.prisma.payment.findMany({
        where: { branchId, createdAt: range },
        include: { child: { select: { id: true, fullName: true } }, recordedBy: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.payment.findMany({ where: { branchId, refundedAt: range }, select: { method: true, amount: true } }),
      this.prisma.expense.findMany({ where: { branchId, date: toDateOnly(date) }, orderBy: { createdAt: "desc" } }),
      this.prisma.cashClosing.findUnique({ where: { branchId_date: { branchId, date: toDateOnly(date) } } }),
    ]);

    const income = emptyByMethod();
    for (const p of payments) {
      income[p.method].count += 1;
      income[p.method].total += Number(p.amount);
    }
    const refunded = emptyByMethod();
    for (const r of refunds) {
      refunded[r.method].count += 1;
      refunded[r.method].total += Number(r.amount);
    }
    const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    // Xarajatlar kassadagi naqd puldan chiqadi deb hisoblanadi.
    const expectedCash = income.CASH.total - refunded.CASH.total - expensesTotal;
    const incomeTotal = METHODS.reduce((sum, m) => sum + income[m].total, 0);
    const refundTotal = METHODS.reduce((sum, m) => sum + refunded[m].total, 0);

    return {
      date,
      income,
      refunded,
      incomeTotal,
      refundTotal,
      expensesTotal,
      expectedCash,
      netTotal: incomeTotal - refundTotal - expensesTotal,
      payments: payments.map((p) => ({
        id: p.id,
        childId: p.childId,
        childName: p.child.fullName,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        note: p.note,
        recordedByName: p.recordedBy?.fullName ?? null,
        createdAt: p.createdAt,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category,
        note: e.note,
        createdByName: e.createdByName,
      })),
      closing: closing
        ? {
            expectedCash: Number(closing.expectedCash),
            countedCash: Number(closing.countedCash),
            difference: Number(closing.difference),
            note: closing.note,
            closedByName: closing.closedByName,
            createdAt: closing.createdAt,
          }
        : null,
    };
  }

  async addExpense(scope: TenantScope, actorName: string, dto: CreateExpenseDto) {
    const branchId = requireMoneyScope(scope);
    const date = assertDate(dto.date.slice(0, 10));
    await this.assertNotClosed(branchId, date);
    const row = await this.prisma.expense.create({
      data: { branchId, date: toDateOnly(date), amount: dto.amount, category: dto.category.trim(), note: dto.note?.trim() || null, createdByName: actorName },
    });
    return { id: row.id };
  }

  async removeExpense(scope: TenantScope, id: string) {
    const branchId = requireMoneyScope(scope);
    const row = await this.prisma.expense.findFirst({ where: { id, branchId } });
    if (!row) {
      throw new NotFoundException("Xarajat topilmadi");
    }
    await this.assertNotClosed(branchId, row.date.toISOString().slice(0, 10));
    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  /** Kunni yopish: tizim hisoblagan naqd bilan kassir sanagan naqd farqi saqlanadi. Yopilgan kun o'zgarmaydi. */
  async close(scope: TenantScope, actorName: string, dto: CloseCashDto) {
    const branchId = requireMoneyScope(scope);
    const date = assertDate(dto.date.slice(0, 10));
    await this.assertNotClosed(branchId, date);
    const day = await this.day(scope, date);
    const difference = dto.countedCash - day.expectedCash;
    if (Math.abs(difference) > 0.005 && !dto.note?.trim()) {
      throw new BadRequestException("Kassada farq bor — sababini izohga yozing");
    }
    await this.prisma.cashClosing.create({
      data: {
        branchId,
        date: toDateOnly(date),
        expectedCash: day.expectedCash,
        countedCash: dto.countedCash,
        difference,
        note: dto.note?.trim() || null,
        closedByName: actorName,
      },
    });
    return { expectedCash: day.expectedCash, countedCash: dto.countedCash, difference };
  }

  /** Qarzdorlar: bola bo'yicha jami qarz, muddati o'tgan qismi va ota-ona telefoni. */
  async debtors(scope: TenantScope) {
    const branchId = requireMoneyScope(scope);
    const invoices = await this.prisma.invoice.findMany({
      where: { branchId, status: { in: [...OPEN_INVOICE] } },
      select: {
        childId: true,
        amount: true,
        discountAmount: true,
        paidAmount: true,
        dueDate: true,
        child: {
          select: {
            fullName: true,
            group: { select: { name: true } },
            guardians: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
              select: { guardian: { select: { fullName: true, phone: true } } },
            },
          },
        },
      },
    });
    const now = Date.now();
    const byChild = new Map<string, {
      childId: string; childName: string; groupName: string | null; guardianName: string | null; guardianPhone: string | null;
      balance: number; overdue: number; oldestDueDate: string | null;
    }>();
    for (const inv of invoices) {
      const remaining = Number(inv.amount) - Number(inv.discountAmount) - Number(inv.paidAmount);
      if (remaining <= 0.005) continue;
      const g = inv.child.guardians[0]?.guardian;
      const row = byChild.get(inv.childId) ?? {
        childId: inv.childId,
        childName: inv.child.fullName,
        groupName: inv.child.group?.name ?? null,
        guardianName: g?.fullName ?? null,
        guardianPhone: g?.phone ?? null,
        balance: 0,
        overdue: 0,
        oldestDueDate: null,
      };
      row.balance += remaining;
      const due = inv.dueDate.getTime();
      if (due < now) {
        row.overdue += remaining;
        if (!row.oldestDueDate || inv.dueDate.toISOString() < row.oldestDueDate) {
          row.oldestDueDate = inv.dueDate.toISOString();
        }
      }
      byChild.set(inv.childId, row);
    }
    const rows = [...byChild.values()].sort((a, b) => b.overdue - a.overdue || b.balance - a.balance);
    return {
      totalDebt: rows.reduce((s, r) => s + r.balance, 0),
      totalOverdue: rows.reduce((s, r) => s + r.overdue, 0),
      rows,
    };
  }

  /** Ota-onaga qarz eslatmasi — bildirishnoma jurnaliga yoziladi (SMS provayder ulanmagan, shuning uchun PENDING). */
  async remind(scope: TenantScope, userId: string, childId: string) {
    const branchId = requireMoneyScope(scope);
    // Ota-onaga qo'ng'iroq qilib eslatish administratorning ishi; kassir to'lov qabul qiladi.
    if (scope.role === "FINANCE") {
      throw new ForbiddenException("Qarz eslatmasini administrator yuboradi");
    }
    const child = await this.prisma.child.findFirst({
      where: { id: childId, branchId, organizationId: scope.organizationId },
      select: { id: true, fullName: true, guardians: { orderBy: [{ isPrimary: "desc" }], take: 1, select: { guardian: { select: { fullName: true, phone: true } } } } },
    });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    const { rows } = await this.debtors(scope);
    const debt = rows.find((r) => r.childId === childId);
    if (!debt) {
      throw new BadRequestException("Bu bolaning qarzi yo'q");
    }
    const guardian = child.guardians[0]?.guardian;
    const amount = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(debt.balance);
    await this.prisma.notificationLog.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        childId,
        eventType: debt.overdue > 0 ? "PAYMENT_OVERDUE" : "PAYMENT_DUE",
        channel: "SMS",
        recipientName: guardian?.fullName ?? "Ota-ona",
        recipientContact: guardian?.phone ?? null,
        message: `${child.fullName} uchun ${amount} UZS to'lov qarzi bor. Iltimos, to'lovni amalga oshiring.`,
        sentByUserId: userId,
      },
    });
    return { success: true };
  }

  /** Oylik hisobot: kunlar bo'yicha kirim, usullar, hisoblangan/yig'ilgan/qarz va xarajatlar. */
  async report(scope: TenantScope, month: string) {
    const branchId = requireMoneyScope(scope);
    if (!month || !MONTH_RE.test(month)) {
      throw new BadRequestException("Oy noto'g'ri (YYYY-MM)");
    }
    const [y, m] = month.split("-").map(Number);
    const first = `${month}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const last = `${month}-${String(lastDay).padStart(2, "0")}`;
    const range = { gte: dayRange(first).gte, lt: dayRange(last).lt };

    const [payments, refunds, expenses, invoices, payroll] = await Promise.all([
      this.prisma.payment.findMany({ where: { branchId, createdAt: range }, select: { amount: true, method: true, createdAt: true } }),
      this.prisma.payment.findMany({ where: { branchId, refundedAt: range }, select: { amount: true } }),
      this.prisma.expense.findMany({ where: { branchId, date: { gte: toDateOnly(first), lte: toDateOnly(last) } }, select: { amount: true, category: true } }),
      this.prisma.invoice.findMany({ where: { branchId, period: month, status: { not: "CANCELLED" } }, select: { amount: true, discountAmount: true, paidAmount: true } }),
      this.prisma.payrollEntry.findMany({ where: { branchId, period: month }, select: { totalAmount: true, status: true } }),
    ]);

    const byMethod = emptyByMethod();
    const byDay = new Map<string, number>();
    for (const p of payments) {
      byMethod[p.method].count += 1;
      byMethod[p.method].total += Number(p.amount);
      const day = new Date(p.createdAt.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(p.amount));
    }
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
    }
    const billed = invoices.reduce((s, i) => s + Number(i.amount) - Number(i.discountAmount), 0);
    const paidOnInvoices = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const collected = METHODS.reduce((s, k) => s + byMethod[k].total, 0);
    const refundTotal = refunds.reduce((s, r) => s + Number(r.amount), 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const salaryPaid = payroll.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.totalAmount), 0);
    const salaryUnpaid = payroll.filter((p) => p.status !== "PAID").reduce((s, p) => s + Number(p.totalAmount), 0);

    return {
      month,
      billed,
      debt: Math.max(billed - paidOnInvoices, 0),
      collected,
      refundTotal,
      expensesTotal,
      // Sof natija: yig'ilgan − qaytarilgan − xarajat − to'langan ish haqi
      salaryPaid,
      salaryUnpaid,
      net: collected - refundTotal - expensesTotal - salaryPaid,
      byMethod,
      days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total })),
      expensesByCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total })),
    };
  }

  /**
   * To'lov qabul qilish uchun: guruhdagi bolalar va ularning ochiq (to'lanmagan) hisob-fakturalari.
   * Barcha davrlar bo'yicha — o'tgan oylardan qolgan qarz ham ko'rinadi.
   */
  async payables(scope: TenantScope, groupId: string) {
    const branchId = requireMoneyScope(scope);
    const children = await this.prisma.child.findMany({
      where: { branchId, status: { not: "INACTIVE" }, ...(groupId === "none" ? { groupId: null } : { groupId }) },
      select: {
        id: true,
        fullName: true,
        invoices: {
          where: { status: { in: [...OPEN_INVOICE] } },
          select: { id: true, period: true, amount: true, discountAmount: true, paidAmount: true, dueDate: true },
          orderBy: { period: "asc" },
        },
      },
      orderBy: { fullName: "asc" },
    });
    return {
      children: children.map((c) => {
        const invoices = c.invoices
          .map((i) => ({
            id: i.id,
            period: i.period,
            remaining: Number(i.amount) - Number(i.discountAmount) - Number(i.paidAmount),
            dueDate: i.dueDate,
          }))
          .filter((i) => i.remaining > 0.005);
        return { childId: c.id, childName: c.fullName, balance: invoices.reduce((s, i) => s + i.remaining, 0), invoices };
      }),
    };
  }

  /**
   * Guruhlar bo'yicha to'lov holati (tanlangan davr uchun): har guruhda nechta bola
   * to'lagan, qisman, muddati o'tgan yoki hisob-fakturasi yo'q.
   */
  async groups(scope: TenantScope, period: string) {
    const branchId = requireMoneyScope(scope);
    const rows = await this.childPaymentRows(branchId, period);
    const groups = await this.prisma.group.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const empty = () => ({ total: 0, paid: 0, partial: 0, overdue: 0, none: 0, billed: 0, collected: 0 });
    const byGroup = new Map<string, ReturnType<typeof empty>>(groups.map((g) => [g.id, empty()]));
    const noGroup = empty();
    for (const r of rows) {
      const bucket = (r.groupId && byGroup.get(r.groupId)) || noGroup;
      bucket.total += 1;
      bucket.billed += r.billed;
      bucket.collected += r.paid;
      if (r.state === "PAID") bucket.paid += 1;
      else if (r.state === "PARTIAL") bucket.partial += 1;
      else if (r.state === "OVERDUE") bucket.overdue += 1;
      else bucket.none += 1;
    }
    const out = groups.map((g) => ({ groupId: g.id as string, name: g.name, ...byGroup.get(g.id)! }));
    if (noGroup.total > 0) out.push({ groupId: "none", name: "Guruhsiz", ...noGroup });
    return { period, groups: out };
  }

  /** Bitta guruhdagi bolalar va ularning to'lov holati (yashil/sariq/qizil) tanlangan davr uchun. */
  async groupChildren(scope: TenantScope, groupId: string, period: string) {
    const branchId = requireMoneyScope(scope);
    const rows = (await this.childPaymentRows(branchId, period)).filter((r) => (groupId === "none" ? !r.groupId : r.groupId === groupId));
    let name = "Guruhsiz";
    if (groupId !== "none") {
      const group = await this.prisma.group.findFirst({ where: { id: groupId, branchId }, select: { name: true } });
      if (!group) {
        throw new NotFoundException("Guruh topilmadi");
      }
      name = group.name;
    }
    return { period, groupId, groupName: name, children: rows.sort((a, b) => a.childName.localeCompare(b.childName)) };
  }

  /**
   * Har bir faol bola uchun davr bo'yicha holat:
   *  NONE — hisob-faktura yo'q; PAID — to'liq to'langan; OVERDUE — muddati o'tgan qarz bor;
   *  PARTIAL — qisman to'langan yoki muddati hali o'tmagan.
   */
  private async childPaymentRows(branchId: string, period: string) {
    if (!MONTH_RE.test(period ?? "")) {
      throw new BadRequestException("Davr noto'g'ri (YYYY-MM)");
    }
    const [children, invoices] = await Promise.all([
      this.prisma.child.findMany({ where: { branchId, status: { not: "INACTIVE" } }, select: { id: true, fullName: true, groupId: true } }),
      this.prisma.invoice.findMany({
        where: { branchId, period, status: { not: "CANCELLED" } },
        select: { childId: true, amount: true, discountAmount: true, paidAmount: true, dueDate: true },
      }),
    ]);
    const now = Date.now();
    const byChild = new Map<string, { billed: number; paid: number; overdue: boolean; dueDate: Date | null }>();
    for (const inv of invoices) {
      const billed = Number(inv.amount) - Number(inv.discountAmount);
      const paid = Number(inv.paidAmount);
      const row = byChild.get(inv.childId) ?? { billed: 0, paid: 0, overdue: false, dueDate: null };
      row.billed += billed;
      row.paid += paid;
      if (billed - paid > 0.005 && inv.dueDate.getTime() < now) row.overdue = true;
      if (!row.dueDate || inv.dueDate < row.dueDate) row.dueDate = inv.dueDate;
      byChild.set(inv.childId, row);
    }
    return children.map((c) => {
      const inv = byChild.get(c.id);
      let state: "NONE" | "PAID" | "PARTIAL" | "OVERDUE" = "NONE";
      if (inv) {
        const remaining = inv.billed - inv.paid;
        state = remaining <= 0.005 ? "PAID" : inv.overdue ? "OVERDUE" : "PARTIAL";
      }
      return {
        childId: c.id,
        childName: c.fullName,
        groupId: c.groupId,
        state,
        billed: inv?.billed ?? 0,
        paid: inv?.paid ?? 0,
        remaining: inv ? Math.max(inv.billed - inv.paid, 0) : 0,
        dueDate: inv?.dueDate ?? null,
      };
    });
  }

  private async assertNotClosed(branchId: string, date: string) {
    const closed = await this.prisma.cashClosing.findUnique({ where: { branchId_date: { branchId, date: toDateOnly(date) } } });
    if (closed) {
      throw new ConflictException("Bu kun kassa yopilgan — o'zgartirib bo'lmaydi");
    }
  }
}
