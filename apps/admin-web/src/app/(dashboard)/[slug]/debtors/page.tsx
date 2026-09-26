"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { canWriteMoney } from "@/lib/permissions";
import { saveCsv, type DebtorsResult } from "@/features/cash/shared";

export default function DebtorsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  // Ota-onaga eslatmani administrator yuboradi; kassir (Moliyachi) to'lov qabul qiladi.
  const canWrite = canWriteMoney(user?.role) && user?.role !== "FINANCE";
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["cash-debtors", slug],
    queryFn: () => api.get<DebtorsResult>("/app/cash/debtors"),
  });

  const remind = useMutation({
    mutationFn: (childId: string) => api.post(`/app/cash/debtors/${childId}/remind`),
    onSuccess: (_, childId) => {
      setError(null);
      setSent((s) => new Set(s).add(childId));
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
  });

  const rows = (query.data?.rows ?? []).filter(
    (r) => (!overdueOnly || r.overdue > 0) && (!search || r.childName.toLowerCase().includes(search.toLowerCase())),
  );

  const exportCsv = () =>
    saveCsv("qarzdorlar.csv", [
      ["Bola", "Guruh", "Ota-ona", "Telefon", "Jami qarz", "Muddati o'tgan"],
      ...rows.map((r) => [r.childName, r.groupName ?? "", r.guardianName ?? "", r.guardianPhone ?? "", r.balance, r.overdue]),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 md:flex-wrap md:items-end">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Qarzdorlar</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Kim qancha qarz va muddati o&apos;tganlar</p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={exportCsv} disabled={rows.length === 0}>
          Eksport (CSV)
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {query.isLoading ? (
        <LoadingState rows={5} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-[12.5px] text-[var(--color-text-muted)]">Jami qarz</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">{formatMoney(query.data?.totalDebt ?? 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[12.5px] text-[var(--color-text-muted)]">Shundan muddati o&apos;tgan</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--color-danger)]">{formatMoney(query.data?.totalOverdue ?? 0)}</p>
            </Card>
          </div>

          <Card className="flex flex-wrap items-end gap-3 p-4">
            <Input label="Bola ismi" placeholder="Qidirish" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[220px]" />
            <Button variant={overdueOnly ? "danger" : "outline"} onClick={() => setOverdueOnly((v) => !v)}>
              Faqat muddati o&apos;tganlar
            </Button>
          </Card>

          {rows.length === 0 ? (
            <Card>
              <EmptyState title="Qarzdor yo'q" />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <DataTable>
                <THead>
                  <tr>
                    <Th>Bola</Th>
                    <Th>Ota-ona</Th>
                    <Th>Jami qarz</Th>
                    <Th>Muddati o&apos;tgan</Th>
                    <Th />
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <Tr key={r.childId}>
                      <Td className="font-medium">
                        <Link href={`/${slug}/finance/${r.childId}`} className="text-[var(--color-primary)] hover:underline">
                          {r.childName}
                        </Link>
                        {r.groupName && <div className="text-[12.5px] font-normal text-[var(--color-text-muted)]">{r.groupName}</div>}
                      </Td>
                      <Td>
                        {r.guardianName ?? "—"}
                        {r.guardianPhone && (
                          <div className="text-[12.5px]">
                            <a href={`tel:${r.guardianPhone}`} className="text-[var(--color-primary)] hover:underline">
                              {r.guardianPhone}
                            </a>
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">{formatMoney(r.balance)}</Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {r.overdue > 0 ? (
                          <>
                            <Badge tone="danger">{formatMoney(r.overdue)}</Badge>
                            {r.oldestDueDate && (
                              <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{formatDate(r.oldestDueDate)} dan</div>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={sent.has(r.childId)}
                              loading={remind.isPending && remind.variables === r.childId}
                              onClick={() => { setError(null); remind.mutate(r.childId); }}
                            >
                              {sent.has(r.childId) ? "Eslatma yuborildi" : "Eslatma"}
                            </Button>
                          )}
                          <Link href={`/${slug}/finance?search=${encodeURIComponent(r.childName)}`}>
                            <Button size="sm">To&apos;lov</Button>
                          </Link>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </DataTable>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
