"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Child, LedgerEntry, Payment } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ArrowLeftIcon, WalletIcon } from "@/components/ui/icons";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";

const LEDGER_TYPE_LABEL: Record<LedgerEntry["type"], string> = {
  CHARGE: "Hisoblandi",
  DISCOUNT: "Chegirma",
  PAYMENT: "To'lov",
  REFUND: "Qaytarish",
  ADJUSTMENT: "Tuzatish",
};

const METHOD_LABEL: Record<Payment["method"], string> = {
  CASH: "Naqd",
  BANK_TRANSFER: "Bank o'tkazmasi",
};

export default function ChildFinancePage({ params }: { params: Promise<{ slug: string; childId: string }> }) {
  const { slug, childId } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const { branchSlug } = useBranchContext(slug);
  const financeHref = branchSlug ? `/${slug}/${branchSlug}/finance` : `/${slug}/finance`;

  const childQuery = useQuery({
    queryKey: ["child", slug, childId],
    queryFn: () => api.get<Child>(`/app/children/${childId}`),
  });

  const ledgerQuery = useQuery({
    queryKey: ["ledger", slug, childId],
    queryFn: () => api.get<LedgerEntry[]>(`/app/children/${childId}/ledger`),
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", slug, childId],
    queryFn: () => getPaginated<Payment>(`/app/payments?childId=${childId}&limit=50`),
  });

  const refundMutation = useMutation({
    mutationFn: (paymentId: string) => api.post(`/app/payments/${paymentId}/refund`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["payments", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
    onError: (err) => alert(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  if (childQuery.isLoading) return <LoadingState />;
  if (childQuery.isError) return <ErrorState message={(childQuery.error as Error).message} />;
  const child = childQuery.data;
  if (!child) return null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={financeHref}
          className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          Moliya
        </Link>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
          {child.fullName}
        </h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Moliyaviy tarix</p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>To&apos;lovlar</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {paymentsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : paymentsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(paymentsQuery.error as Error).message} />
            </div>
          ) : !paymentsQuery.data || paymentsQuery.data.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title="To'lovlar yo'q"
                description="Bu bola uchun hali to'lov qayd etilmagan"
                icon={<WalletIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {paymentsQuery.data.data.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium tabular-nums text-[var(--color-text)]">
                      {formatMoney(payment.amount, payment.currency)} — {METHOD_LABEL[payment.method]}
                    </p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">
                      {formatDateTime(payment.createdAt)}
                      {payment.note ? ` • ${payment.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={payment.status === "COMPLETED" ? "success" : "neutral"}>
                      {payment.status === "COMPLETED" ? "Amalda" : "Qaytarilgan"}
                    </Badge>
                    {canWrite && payment.status === "COMPLETED" && (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={refundMutation.isPending && refundMutation.variables === payment.id}
                        onClick={() => {
                          if (confirm("Bu to'lovni qaytarishni tasdiqlaysizmi?")) {
                            refundMutation.mutate(payment.id);
                          }
                        }}
                      >
                        Qaytarish
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Moliyaviy tarix (ledger)</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {ledgerQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={5} />
            </div>
          ) : ledgerQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(ledgerQuery.error as Error).message} />
            </div>
          ) : !ledgerQuery.data || ledgerQuery.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState title="Yozuvlar yo'q" />
            </div>
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Sana</Th>
                  <Th>Turi</Th>
                  <Th numeric>Summa</Th>
                  <Th>Davr</Th>
                  <Th>Izoh</Th>
                </tr>
              </THead>
              <TBody>
                {ledgerQuery.data.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDateTime(entry.createdAt)}</Td>
                    <Td>{LEDGER_TYPE_LABEL[entry.type]}</Td>
                    <Td
                      numeric
                      className={`font-medium ${Number(entry.amount) < 0 ? "text-[var(--color-success)]" : "text-[var(--color-text)]"}`}
                    >
                      {Number(entry.amount) > 0 ? "+" : ""}
                      {formatMoney(entry.amount)}
                    </Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{entry.invoice?.period ?? "—"}</Td>
                    <Td className="text-[var(--color-text-muted)]">{entry.note ?? "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
