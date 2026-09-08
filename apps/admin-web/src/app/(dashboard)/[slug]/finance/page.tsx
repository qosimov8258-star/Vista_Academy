"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatMoney } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { CreateInvoiceModal } from "@/features/finance/create-invoice-modal";
import { RecordPaymentModal } from "@/features/finance/record-payment-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";

const STATUS_LABEL: Record<Invoice["status"], string> = {
  PENDING: "Kutilmoqda",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  OVERDUE: "Muddati o'tgan",
  CANCELLED: "Bekor qilingan",
};

const STATUS_TONE: Record<Invoice["status"], "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export default function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", slug, page, forcedBranchId],
    queryFn: () =>
      getPaginated<Invoice>(`/app/invoices?page=${page}&limit=20${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`),
    placeholderData: (prev) => prev,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv(
        `/app/exports/invoices${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`,
        "hisob-fakturalar.csv",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Moliya</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Ota-onalar uchun hisob-fakturalar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" loading={exporting} onClick={handleExport}>
            Eksport (CSV)
          </Button>
          {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi hisob-faktura</Button>}
        </div>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {invoicesQuery.isLoading ? (
        <LoadingState />
      ) : invoicesQuery.isError ? (
        <ErrorState message={(invoicesQuery.error as Error).message} />
      ) : !invoicesQuery.data || invoicesQuery.data.data.length === 0 ? (
        <EmptyState title="Hisob-faktura topilmadi" description={canWrite ? "Yangi hisob-faktura yaratish uchun tugmani bosing" : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Bola</th>
                  <th className="px-5 py-3 font-medium">Davr</th>
                  <th className="px-5 py-3 font-medium">Summa</th>
                  <th className="px-5 py-3 font-medium">Chegirma</th>
                  <th className="px-5 py-3 font-medium">To'langan</th>
                  <th className="px-5 py-3 font-medium">Qoldiq</th>
                  <th className="px-5 py-3 font-medium">Muddat</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {invoicesQuery.data.data.map((invoice) => {
                  const net = Number(invoice.amount) - Number(invoice.discountAmount);
                  const remaining = net - Number(invoice.paidAmount);
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium">
                        <Link
                          href={`/${slug}/finance/${invoice.childId}`}
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          {invoice.child?.fullName ?? "—"}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{invoice.period}</td>
                      <td className="px-5 py-3 text-[var(--color-text)]">{formatMoney(invoice.amount, invoice.currency)}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">
                        {Number(invoice.discountAmount) > 0 ? formatMoney(invoice.discountAmount, invoice.currency) : "—"}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-success)]">{formatMoney(invoice.paidAmount, invoice.currency)}</td>
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{formatMoney(remaining, invoice.currency)}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDate(invoice.dueDate)}</td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canWrite && (invoice.status === "PENDING" || invoice.status === "PARTIALLY_PAID" || invoice.status === "OVERDUE") && (
                          <Button size="sm" variant="secondary" onClick={() => setPayInvoice(invoice)}>
                            To&apos;lov qabul qilish
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-muted)]">
            <span>
              Jami {invoicesQuery.data.meta.total} ta, {invoicesQuery.data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * invoicesQuery.data.meta.limit >= invoicesQuery.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {canWrite && <CreateInvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
      {canWrite && payInvoice && (
        <RecordPaymentModal open={!!payInvoice} onClose={() => setPayInvoice(null)} slug={slug} invoice={payInvoice} />
      )}
    </div>
  );
}
