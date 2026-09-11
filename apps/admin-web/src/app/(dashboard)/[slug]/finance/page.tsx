"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { FinanceSummary, Invoice } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatMoney } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { CreateInvoiceModal } from "@/features/finance/create-invoice-modal";
import { BulkCreateInvoiceModal } from "@/features/finance/bulk-create-invoice-modal";
import { RecordPaymentModal } from "@/features/finance/record-payment-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [exporting, setExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", slug, page, forcedBranchId, overdueOnly, search, period],
    queryFn: () =>
      getPaginated<Invoice>(
        `/app/invoices?page=${page}&limit=20${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}${overdueOnly ? "&overdueOnly=true" : ""}` +
          (search ? `&search=${encodeURIComponent(search)}` : "") +
          (period ? `&period=${period}` : ""),
      ),
    placeholderData: (prev) => prev,
  });

  const summaryQuery = useQuery({
    queryKey: ["finance-summary", slug, forcedBranchId],
    queryFn: () => api.get<FinanceSummary>(`/app/finance/summary?period=${currentPeriod()}`),
  });

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(
        `/app/exports/invoices${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`,
        "hisob-fakturalar.csv",
      );
    } catch {
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
    } finally {
      setExporting(false);
    }
  };

  const handleInvoicePdf = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/invoices/${invoiceId}/pdf`, `hisob-faktura-${invoiceId}.pdf`);
    } catch {
      setExportError("PDF yuklab bo'lmadi — qayta urinib ko'ring");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Moliya</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Ota-onalar uchun hisob-fakturalar</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={overdueOnly ? "danger" : "outline"}
            onClick={() => {
              setOverdueOnly((v) => !v);
              setPage(1);
            }}
          >
            Muddati o&apos;tganlar
          </Button>
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            Eksport (CSV)
          </Button>
          {canWrite && (
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              Ommaviy hisob-faktura
            </Button>
          )}
          {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi hisob-faktura</Button>}
        </div>
      </div>

      {summaryQuery.data && (
        <Card className="flex flex-wrap items-center gap-6 p-4">
          <p className="text-[13px] font-medium text-[var(--color-text-muted)]">
            Naqd vs o&apos;tkazma ({summaryQuery.data.period})
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--color-text-muted)]">Naqd:</span>
            <span className="text-[14px] font-semibold tabular-nums text-[var(--color-text)]">
              {formatMoney(summaryQuery.data.byMethod.CASH.amount)} ({summaryQuery.data.byMethod.CASH.count})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--color-text-muted)]">O&apos;tkazma:</span>
            <span className="text-[14px] font-semibold tabular-nums text-[var(--color-text)]">
              {formatMoney(summaryQuery.data.byMethod.BANK_TRANSFER.amount)} ({summaryQuery.data.byMethod.BANK_TRANSFER.count})
            </span>
          </div>
        </Card>
      )}

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <Input
          placeholder="Bola ismi bo'yicha qidirish"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <Input
          placeholder="Davr (YYYY-MM)"
          value={period}
          onChange={(e) => {
            setPage(1);
            setPeriod(e.target.value);
          }}
        />
      </Card>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {exportError}
        </div>
      )}

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {invoicesQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : invoicesQuery.isError ? (
        <ErrorState message={(invoicesQuery.error as Error).message} />
      ) : !invoicesQuery.data || invoicesQuery.data.data.length === 0 ? (
        <EmptyState
          title="Hisob-faktura topilmadi"
          description={
            search || period
              ? "Qidiruv yoki filtr shartini o'zgartiring"
              : canWrite
                ? "Yangi hisob-faktura yaratish uchun tugmani bosing"
                : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>Bola</Th>
                <Th>Davr</Th>
                <Th numeric>Summa</Th>
                <Th numeric>Chegirma</Th>
                <Th numeric>To'langan</Th>
                <Th numeric>Qoldiq</Th>
                <Th>Muddat</Th>
                <Th>Holat</Th>
                <Th></Th>
              </tr>
            </THead>
            <TBody>
              {invoicesQuery.data.data.map((invoice) => {
                const net = Number(invoice.amount) - Number(invoice.discountAmount);
                const remaining = net - Number(invoice.paidAmount);
                return (
                  <Tr key={invoice.id}>
                    <Td className="font-medium">
                      <Link
                        href={`/${slug}/finance/${invoice.childId}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {invoice.child?.fullName ?? "—"}
                      </Link>
                    </Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{invoice.period}</Td>
                    <Td numeric>{formatMoney(invoice.amount, invoice.currency)}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">
                      {Number(invoice.discountAmount) > 0 ? formatMoney(invoice.discountAmount, invoice.currency) : "—"}
                    </Td>
                    <Td numeric>
                      {/* Yashil rang span'da: Td'ning sukut matn rangi utilitalar tartibida
                          `--color-success` dan keyin turadi va uni bosib ketardi */}
                      <span className="text-[var(--color-success)]">
                        {formatMoney(invoice.paidAmount, invoice.currency)}
                      </span>
                    </Td>
                    <Td numeric className="font-medium">{formatMoney(remaining, invoice.currency)}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(invoice.dueDate)}</Td>
                    <Td>
                      <Badge tone={invoice.overdue ? "danger" : STATUS_TONE[invoice.status]}>
                        {invoice.overdue ? "Muddati o'tgan" : STATUS_LABEL[invoice.status]}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={downloadingId === invoice.id}
                          onClick={() => handleInvoicePdf(invoice.id)}
                        >
                          PDF
                        </Button>
                        {canWrite && (invoice.status === "PENDING" || invoice.status === "PARTIALLY_PAID" || invoice.status === "OVERDUE") && (
                          <Button size="sm" variant="outline" onClick={() => setPayInvoice(invoice)}>
                            To&apos;lov qabul qilish
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </DataTable>

          <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
            <span className="tabular-nums">
              Jami {invoicesQuery.data.meta.total} ta, {invoicesQuery.data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="outline"
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
      {canWrite && <BulkCreateInvoiceModal open={bulkOpen} onClose={() => setBulkOpen(false)} slug={slug} />}
      {canWrite && payInvoice && (
        <RecordPaymentModal open={!!payInvoice} onClose={() => setPayInvoice(null)} slug={slug} invoice={payInvoice} />
      )}
    </div>
  );
}
