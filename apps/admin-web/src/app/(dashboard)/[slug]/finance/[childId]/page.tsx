"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Child, LedgerEntry, Payment } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useBranchContext } from "@/lib/use-branch-context";

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
  const canWrite = user?.role !== "NETWORK_ADMIN";
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
    <div className="space-y-6">
      <div>
        <Link href={financeHref} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← Moliya
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{child.fullName}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Moliyaviy tarix</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lovlar</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {paymentsQuery.isLoading ? (
            <LoadingState />
          ) : paymentsQuery.isError ? (
            <ErrorState message={(paymentsQuery.error as Error).message} />
          ) : !paymentsQuery.data || paymentsQuery.data.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">To&apos;lovlar yo&apos;q</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {paymentsQuery.data.data.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {formatMoney(payment.amount, payment.currency)} — {METHOD_LABEL[payment.method]}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatDateTime(payment.createdAt)}
                      {payment.note ? ` • ${payment.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle>Moliyaviy tarix (ledger)</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {ledgerQuery.isLoading ? (
            <LoadingState />
          ) : ledgerQuery.isError ? (
            <ErrorState message={(ledgerQuery.error as Error).message} />
          ) : !ledgerQuery.data || ledgerQuery.data.length === 0 ? (
            <EmptyState title="Yozuvlar yo'q" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Sana</th>
                    <th className="px-5 py-3 font-medium">Turi</th>
                    <th className="px-5 py-3 font-medium">Summa</th>
                    <th className="px-5 py-3 font-medium">Davr</th>
                    <th className="px-5 py-3 font-medium">Izoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {ledgerQuery.data.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-5 py-3">{LEDGER_TYPE_LABEL[entry.type]}</td>
                      <td
                        className={`px-5 py-3 font-medium ${Number(entry.amount) < 0 ? "text-[var(--color-success)]" : "text-[var(--color-text)]"}`}
                      >
                        {Number(entry.amount) > 0 ? "+" : ""}
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{entry.invoice?.period ?? "—"}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{entry.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
