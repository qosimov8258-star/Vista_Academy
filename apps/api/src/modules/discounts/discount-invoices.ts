import { InvoiceStatus, Prisma } from "@prisma/client";
import { type DiscountRule, discountFor } from "./discount-rules";

const EPSILON = 0.01;
const OPEN: InvoiceStatus[] = [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE];

/** Bola qoidalari — hisob-kitob uchun kerakli maydonlar */
export const discountRuleSelect = {
  id: true,
  type: true,
  scope: true,
  value: true,
  startPeriod: true,
  endPeriod: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.ChildDiscountSelect;

export function childRules(tx: Prisma.TransactionClient, childId: string): Promise<DiscountRule[]> {
  return tx.childDiscount.findMany({ where: { childId }, select: discountRuleSelect });
}

export interface InvoiceDiscountChange {
  period: string;
  from: number;
  to: number;
}

/**
 * Qoidalar o'zgargach (`before` → `after`) bolaning to'lanmagan hisob-
 * fakturalarini moslaydi. Faqat qoida natijasi o'zgargan oylar tegiladi va
 * farq (`after − before`) qo'shiladi — hisob-faktura yaratilganda qo'lda
 * yozilgan chegirma saqlanib qoladi.
 *
 * - To'langan oy o'zgarmaydi (ortiqcha to'lov yoki yangi qarz paydo bo'lmasin);
 * - qisman to'langan oyda chegirma to'langan summadan pastga tushirmaydi;
 * - har o'zgarish bola tarixiga DISCOUNT yozuvi bo'lib tushadi.
 */
export async function applyRuleChangeToInvoices(
  tx: Prisma.TransactionClient,
  args: { organizationId: string; branchId: string; childId: string; before: readonly DiscountRule[]; after: readonly DiscountRule[]; note: string },
): Promise<{ changed: InvoiceDiscountChange[]; paidUnchanged: string[]; capped: string[] }> {
  const invoices = await tx.invoice.findMany({
    where: { childId: args.childId, status: { in: [...OPEN, InvoiceStatus.PAID] } },
    orderBy: { period: "asc" },
  });
  const changed: InvoiceDiscountChange[] = [];
  const paidUnchanged: string[] = [];
  const capped: string[] = [];

  for (const inv of invoices) {
    const amount = Number(inv.amount);
    const before = discountFor(args.before, inv.period, amount);
    const after = discountFor(args.after, inv.period, amount);
    if (Math.abs(after - before) < EPSILON) continue;
    if (inv.status === InvoiceStatus.PAID) {
      paidUnchanged.push(inv.period);
      continue;
    }
    const current = Number(inv.discountAmount);
    const paid = Number(inv.paidAmount);
    const wanted = current + after - before;
    const next = Math.round(Math.min(Math.max(wanted, 0), Math.max(0, amount - paid)) * 100) / 100;
    if (Math.abs(next - wanted) >= EPSILON) capped.push(inv.period);
    if (Math.abs(next - current) < EPSILON) continue;

    const net = amount - next;
    const status = paid >= net - EPSILON ? InvoiceStatus.PAID : paid > EPSILON ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.PENDING;
    await tx.invoice.update({
      where: { id: inv.id },
      data: { discountAmount: next, status, paidAt: status === InvoiceStatus.PAID ? (inv.paidAt ?? new Date()) : null },
    });
    await tx.ledgerEntry.create({
      data: {
        organizationId: args.organizationId,
        branchId: args.branchId,
        childId: args.childId,
        type: "DISCOUNT",
        amount: -(next - current),
        invoiceId: inv.id,
        note: `${args.note} — ${inv.period}`,
      },
    });
    changed.push({ period: inv.period, from: current, to: next });
  }
  return { changed, paidUnchanged, capped };
}
