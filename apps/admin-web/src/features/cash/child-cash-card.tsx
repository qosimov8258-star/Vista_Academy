"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { getPaginated } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { PAGE_CARD, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { PaymentSheet } from "@/features/payments/payment-sheet";
import { groupDigits, periodLabel } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";

const OPEN_STATUSES = new Set(["PENDING", "PARTIALLY_PAID", "OVERDUE"]);

/**
 * Bola sahifasidagi kassa: shu bolaning qarzi (oylar bo'yicha) va
 * "To'lov qabul qilish" — to'lov varag'ini ochadi (To'lovlar sahifasidagi
 * bilan bir xil forma). Ota-ona to'lov qilgani kelganda kassir shu yerda ishlaydi.
 */
export function ChildCashCard({ slug, childId, childName }: { slug: string; childId: string; childName: string }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const invoicesQuery = useQuery({
    queryKey: ["pay-invoices", slug, childId],
    queryFn: () => getPaginated<Invoice>(`/app/invoices?childId=${childId}&limit=100`),
  });
  const openInvoices = (invoicesQuery.data?.data ?? [])
    .filter((i) => OPEN_STATUSES.has(i.status))
    .map((i) => ({ id: i.id, period: i.period, overdue: i.overdue, remaining: Number(i.amount) - Number(i.discountAmount) - Number(i.paidAmount) }))
    .filter((i) => i.remaining > 0.005)
    .sort((a, b) => a.period.localeCompare(b.period));
  const debt = openInvoices.reduce((s, i) => s + i.remaining, 0);

  return (
    <section className={`${PAGE_CARD} p-4`}>
      <div className="flex items-center gap-3">
        <IosIcon icon={Wallet} tint="green" size={30} />
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--color-text)]">{tr("Kassa")}</span>
        {invoicesQuery.isLoading ? (
          <span className="h-6 w-24 animate-pulse rounded-lg bg-[#767680]/[0.12]" />
        ) : debt > 0 ? (
          <span className="text-[20px] font-bold tabular-nums" style={{ color: IOS.red }}>
            −{groupDigits(debt)} <span className="text-[13px] font-semibold">{tr("so'm")}</span>
          </span>
        ) : (
          <span className="text-[15px] font-semibold" style={{ color: IOS.green }}>
            {tr("Qarz yo'q")} ✓
          </span>
        )}
      </div>
      {openInvoices.length > 0 && (
        <p className="mt-2 text-[13px] leading-snug text-[#8e8e93]">
          {openInvoices.map((i) => `${periodLabel(i.period, tr)} — ${groupDigits(i.remaining)}`).join(" · ")}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[var(--color-primary)] text-[16px] font-semibold text-white transition-transform active:scale-[0.97]"
      >
        {tr("To'lov qabul qilish")}
      </button>
      <PaymentSheet slug={slug} child={open ? { id: childId, name: childName } : null} onClose={() => setOpen(false)} />
    </section>
  );
}
