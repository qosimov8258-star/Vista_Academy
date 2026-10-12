"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { downloadCsv } from "@/lib/download";
import { formatMoney } from "@/lib/format";
import { canWriteMoney } from "@/lib/permissions";
import { METHODS, METHOD_LABEL, todayTashkent, type CashDay } from "@/features/cash/shared";
import { CategoryTile, ExpenseSheet, type ExpenseSheetRequest } from "@/features/expenses/expense-sheet";
import { useTr } from "@/i18n/tr";

function Tile({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  const tr = useTr();
  return (
    <Card className="p-4">
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr(label)}</p>
      <p
        className={`mt-1 text-[20px] font-semibold tabular-nums ${
          tone === "danger" ? "text-[var(--color-danger)]" : tone === "success" ? "text-[var(--color-success)]" : "text-[var(--color-text)]"
        }`}
      >
        {tr(value)}
      </p>
    </Card>
  );
}

export default function CashPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [expenseSheet, setExpenseSheet] = useState<ExpenseSheetRequest>(null);

  useEffect(() => setDate((d) => d || todayTashkent()), []);

  const dayQuery = useQuery({
    queryKey: ["cash-day", slug, date],
    queryFn: () => api.get<CashDay>(`/app/cash/day?date=${date}`),
    enabled: !!date,
    // Boshqa oynada qabul qilingan to'lovlar ham o'zi ko'rinib qoladi
    refetchInterval: 30_000,
  });

  const openReceipt = async (id: string) => {
    setReceiptId(id);
    setError(null);
    try {
      await downloadCsv(`/app/exports/payments/${id}/pdf`, `tolov-kvitansiyasi-${id}.pdf`);
    } catch {
      setError(tr("Kvitansiyani yuklab bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setReceiptId(null);
    }
  };

  const day = dayQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Kassa")}</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">{tr("Kunlik kirim, xarajat va kassa yopilishi")}</p>
        </div>
        <div className="w-[190px]">
          <Input label={tr("Sana")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{tr(error)}</div>
      )}

      {!date || dayQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : dayQuery.isError ? (
        <ErrorState message={tr((dayQuery.error as Error).message)} />
      ) : day ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={tr("Jami kirim")} value={formatMoney(day.incomeTotal)} tone="success" />
            {METHODS.filter((m) => m === "CASH" || day.income[m].count > 0).map((m) => (
              <Tile key={m} label={tr(`${METHOD_LABEL[m]} (${day.income[m].count})`)} value={formatMoney(day.income[m].total)} />
            ))}
            <Tile label={tr("Qaytarilgan")} value={formatMoney(day.refundTotal)} tone={day.refundTotal > 0 ? "danger" : undefined} />
            <Tile label={tr("Xarajat")} value={formatMoney(day.expensesTotal)} tone={day.expensesTotal > 0 ? "danger" : undefined} />
            {/* Faqat naqd xarajat kassadan chiqadi — kassir sanab solishtirishi uchun */}
            <Tile label={tr("Kassada bo'lishi kerak (naqd)")} value={formatMoney(day.expectedCash)} />
            <Tile label={tr("Sof natija")} value={formatMoney(day.netTotal)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tr("Bugungi to'lovlar")}</CardTitle>
            </CardHeader>
            <CardBody>
              {day.payments.length === 0 ? (
                <EmptyState title={tr("Bu kunda to'lov yo'q")} />
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {day.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/${slug}/finance/${p.childId}`} className="font-medium text-[var(--color-primary)] hover:underline">
                          {tr(p.childName)}
                        </Link>
                        <p className="text-[12.5px] text-[var(--color-text-muted)]">
                          {new Date(p.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" })}
                          {" · "}
                          {tr(METHOD_LABEL[p.method])}
                          {p.recordedByName ? ` · ${p.recordedByName}` : ""}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <b className="tabular-nums">{formatMoney(p.amount)}</b>
                        <Badge tone={p.status === "COMPLETED" ? "success" : "neutral"}>{p.status === "COMPLETED" ? "Amalda" : "Qaytarilgan"}</Badge>
                        <Button size="sm" variant="outline" loading={receiptId === p.id} onClick={() => openReceipt(p.id)}>
                          {tr("Chek")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Xarajatlar — qator bosilsa tafsilot (tahrirlash/o'chirish), qo'shish — Xarajatlar sahifasidagi varaq */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{tr("Xarajatlar")}</CardTitle>
              <Link href={`/${slug}/expenses`} className="text-[14px] font-medium text-[var(--color-primary)] hover:underline">
                {tr("Barcha xarajatlar")} ›
              </Link>
            </CardHeader>
            <CardBody className="space-y-4">
              {day.expenses.length === 0 ? (
                <EmptyState title={tr("Bu kunda xarajat yo'q")} />
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {day.expenses.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setExpenseSheet({ kind: "view", expense: { ...e, locked: e.locked || !!day.closing } })}
                        className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-60"
                      >
                        <CategoryTile category={e.category} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-[var(--color-text)]">{e.note || tr(e.category)}</span>
                          <span className="block truncate text-[12.5px] text-[var(--color-text-muted)]">
                            {[e.note ? tr(e.category) : null, tr(METHOD_LABEL[e.method]), e.createdByName].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <b className="shrink-0 tabular-nums">{formatMoney(e.amount)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && !day.closing && (
                <Button onClick={() => setExpenseSheet({ kind: "new", date })}>{tr("Xarajat qo'shish")}</Button>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <ExpenseSheet request={expenseSheet} onClose={() => setExpenseSheet(null)} />
    </div>
  );
}
