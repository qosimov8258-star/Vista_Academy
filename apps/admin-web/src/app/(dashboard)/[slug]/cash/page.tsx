"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { downloadCsv } from "@/lib/download";
import { formatMoney } from "@/lib/format";
import { canWriteMoney } from "@/lib/permissions";
import { AcceptPaymentCard } from "@/features/cash/accept-payment-card";
import { EXPENSE_CATEGORIES, METHODS, METHOD_LABEL, todayTashkent, type CashDay } from "@/features/cash/shared";

function Tile({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <Card className="p-4">
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`mt-1 text-[20px] font-semibold tabular-nums ${
          tone === "danger" ? "text-[var(--color-danger)]" : tone === "success" ? "text-[var(--color-success)]" : "text-[var(--color-text)]"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

export default function CashPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  // xarajat formasi
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  // kassa yopish
  const [counted, setCounted] = useState("");
  const [closeNote, setCloseNote] = useState("");

  useEffect(() => setDate((d) => d || todayTashkent()), []);

  const dayQuery = useQuery({
    queryKey: ["cash-day", slug, date],
    queryFn: () => api.get<CashDay>(`/app/cash/day?date=${date}`),
    enabled: !!date,
    // Boshqa oynada qabul qilingan to'lovlar ham o'zi ko'rinib qoladi
    refetchInterval: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["cash-day", slug] });
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");

  const addExpense = useMutation({
    mutationFn: () => api.post("/app/cash/expenses", { date, amount: Number(amount), category, note: note.trim() || undefined }),
    onSuccess: () => {
      setAmount("");
      setNote("");
      setError(null);
      refresh();
    },
    onError: fail,
  });
  const removeExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/app/cash/expenses/${id}`),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: fail,
  });
  const closeDay = useMutation({
    mutationFn: () => api.post("/app/cash/close", { date, countedCash: Number(counted), note: closeNote.trim() || undefined }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: fail,
  });

  const openReceipt = async (id: string) => {
    setReceiptId(id);
    setError(null);
    try {
      await downloadCsv(`/app/exports/payments/${id}/pdf`, `tolov-kvitansiyasi-${id}.pdf`);
    } catch {
      setError("Kvitansiyani yuklab bo'lmadi — qayta urinib ko'ring");
    } finally {
      setReceiptId(null);
    }
  };

  const day = dayQuery.data;
  const diff = day && counted !== "" ? Number(counted) - day.expectedCash : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Kassa</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Kunlik kirim, xarajat va kassa yopilishi</p>
        </div>
        <div className="w-[190px]">
          <Input label="Sana" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      {canWrite && <AcceptPaymentCard slug={slug} />}

      {!date || dayQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : dayQuery.isError ? (
        <ErrorState message={(dayQuery.error as Error).message} />
      ) : day ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Jami kirim" value={formatMoney(day.incomeTotal)} tone="success" />
            {METHODS.map((m) => (
              <Tile key={m} label={`${METHOD_LABEL[m]} (${day.income[m].count})`} value={formatMoney(day.income[m].total)} />
            ))}
            <Tile label="Qaytarilgan" value={formatMoney(day.refundTotal)} tone={day.refundTotal > 0 ? "danger" : undefined} />
            <Tile label="Xarajat" value={formatMoney(day.expensesTotal)} tone={day.expensesTotal > 0 ? "danger" : undefined} />
            <Tile label="Sof natija" value={formatMoney(day.netTotal)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kassa yopilishi</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-[14px]">
              <p>
                Kassada bo&apos;lishi kerak naqd pul:{" "}
                <b className="tabular-nums">{formatMoney(day.expectedCash)}</b>
                <span className="text-[var(--color-text-muted)]"> (naqd kirim − naqd qaytarish − xarajat)</span>
              </p>
              {day.closing ? (
                <div className="space-y-1 rounded-lg bg-[var(--color-surface-sunken)] p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="success">Kassa yopilgan</Badge>
                    <span className="text-[var(--color-text-muted)]">{day.closing.closedByName}</span>
                  </p>
                  <p>
                    Sanalgan: <b className="tabular-nums">{formatMoney(day.closing.countedCash)}</b> · Farq:{" "}
                    <b className={`tabular-nums ${Math.abs(day.closing.difference) > 0.005 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>
                      {formatMoney(day.closing.difference)}
                    </b>
                  </p>
                  {day.closing.note && <p className="text-[var(--color-text-muted)]">Izoh: {day.closing.note}</p>}
                </div>
              ) : canWrite ? (
                <div className="flex flex-wrap items-end gap-3">
                  <Input label="Sanalgan naqd pul" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} className="w-[200px]" />
                  <Input label={diff !== null && Math.abs(diff) > 0.005 ? "Farq sababi (majburiy)" : "Izoh (ixtiyoriy)"} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} className="min-w-[220px] flex-1" />
                  <Button loading={closeDay.isPending} disabled={counted === ""} onClick={() => { setError(null); closeDay.mutate(); }}>
                    Kassani yopish
                  </Button>
                  {diff !== null && (
                    <p className={`basis-full text-[13px] ${Math.abs(diff) > 0.005 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>
                      {Math.abs(diff) > 0.005
                        ? `Farq: ${formatMoney(diff)} (${diff > 0 ? "ortiqcha" : "kam"})`
                        : "Kassa to'g'ri keldi"}
                    </p>
                  )}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bugungi to&apos;lovlar</CardTitle>
            </CardHeader>
            <CardBody>
              {day.payments.length === 0 ? (
                <EmptyState title="Bu kunda to'lov yo'q" />
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {day.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/${slug}/finance/${p.childId}`} className="font-medium text-[var(--color-primary)] hover:underline">
                          {p.childName}
                        </Link>
                        <p className="text-[12.5px] text-[var(--color-text-muted)]">
                          {new Date(p.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" })}
                          {" · "}
                          {METHOD_LABEL[p.method]}
                          {p.recordedByName ? ` · ${p.recordedByName}` : ""}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <b className="tabular-nums">{formatMoney(p.amount)}</b>
                        <Badge tone={p.status === "COMPLETED" ? "success" : "neutral"}>{p.status === "COMPLETED" ? "Amalda" : "Qaytarilgan"}</Badge>
                        <Button size="sm" variant="outline" loading={receiptId === p.id} onClick={() => openReceipt(p.id)}>
                          Chek
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Xarajatlar</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {day.expenses.length === 0 ? (
                <EmptyState title="Bu kunda xarajat yo'q" />
              ) : (
                <ul className="divide-y divide-[var(--color-border)] text-[14px]">
                  {day.expenses.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <span className="font-medium">{e.category}</span>
                        <p className="text-[12.5px] text-[var(--color-text-muted)]">
                          {e.createdByName}
                          {e.note ? ` · ${e.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <b className="tabular-nums">{formatMoney(e.amount)}</b>
                        {canWrite && !day.closing && (
                          <Button size="sm" variant="danger" loading={removeExpense.isPending && removeExpense.variables === e.id} onClick={() => removeExpense.mutate(e.id)}>
                            O&apos;chirish
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && !day.closing && (
                <div className="flex flex-wrap items-end gap-3 border-t border-[var(--color-separator)] pt-4">
                  <Input label="Summa" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-[160px]" />
                  <Select label="Turi" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Input label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} className="min-w-[200px] flex-1" />
                  <Button loading={addExpense.isPending} disabled={!(Number(amount) > 0)} onClick={() => { setError(null); addExpense.mutate(); }}>
                    Qo&apos;shish
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
