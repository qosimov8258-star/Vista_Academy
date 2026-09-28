"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { downloadCsv } from "@/lib/download";
import { formatMoney } from "@/lib/format";
import { METHODS, METHOD_LABEL, currentMonth, type CashMethod, type GroupPaymentSummary } from "./shared";

interface Payable {
  childId: string;
  childName: string;
  balance: number;
  invoices: { id: string; period: string; remaining: number; dueDate: string }[];
}

/**
 * Kassirning asosiy ishi: guruh → bola → hisob-faktura tanlab, to'lovni qabul qilish.
 * Qabul qilingan to'lov darrov shu sahifadagi bugungi kassaga tushadi.
 */
export function AcceptPaymentCard({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState("");
  const [childId, setChildId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<CashMethod>("CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ paymentId: string; text: string } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ["cash-groups", slug, currentMonth()],
    queryFn: () => api.get<{ groups: GroupPaymentSummary[] }>(`/app/cash/groups?period=${currentMonth()}`),
  });
  const payablesQuery = useQuery({
    queryKey: ["cash-payables", slug, groupId],
    queryFn: () => api.get<{ children: Payable[] }>(`/app/cash/payables/${groupId}`),
    enabled: !!groupId,
  });

  const child = payablesQuery.data?.children.find((c) => c.childId === childId);
  const invoice = child?.invoices.find((i) => i.id === invoiceId);

  // Bola tanlanganda eng eski qarz tanlanadi va summa shu qarzga to'ladi.
  useEffect(() => {
    const first = child?.invoices[0];
    setInvoiceId(first?.id ?? "");
    setAmount(first ? String(first.remaining) : "");
  }, [child]);

  const pay = useMutation({
    mutationFn: () =>
      api.post<{ payment: { id: string } }>("/app/payments", {
        invoiceId,
        amount: Number(amount),
        method,
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      setError(null);
      setDone({ paymentId: res.payment.id, text: `${child?.childName}: ${formatMoney(Number(amount))} (${METHOD_LABEL[method]}) qabul qilindi` });
      setChildId("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["cash-day", slug] });
      queryClient.invalidateQueries({ queryKey: ["cash-payables", slug] });
      queryClient.invalidateQueries({ queryKey: ["cash-groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["cash-group-children", slug] });
      queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
  });

  const openReceipt = async () => {
    if (!done) return;
    setReceiptLoading(true);
    try {
      await downloadCsv(`/app/exports/payments/${done.paymentId}/pdf`, `tolov-kvitansiyasi-${done.paymentId}.pdf`);
    } catch {
      setError("Kvitansiyani yuklab bo'lmadi — qayta urinib ko'ring");
    } finally {
      setReceiptLoading(false);
    }
  };

  const canSubmit = !!invoiceId && Number(amount) > 0 && (!invoice || Number(amount) <= invoice.remaining + 0.005);

  return (
    <Card>
      <CardHeader>
        <CardTitle>To&apos;lov qabul qilish</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {error && <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>}
        {done && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">
            <span>{done.text}</span>
            <Button size="sm" variant="outline" loading={receiptLoading} onClick={openReceipt}>
              Chek
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Guruh"
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              setChildId("");
              setDone(null);
            }}
          >
            <option value="" disabled>
              Guruhni tanlang
            </option>
            {groupsQuery.data?.groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.name} ({g.total} bola)
              </option>
            ))}
          </Select>
          <Select label="Bola" value={childId} disabled={!groupId} onChange={(e) => { setChildId(e.target.value); setDone(null); }}>
            <option value="" disabled>
              {groupId ? "Bolani tanlang" : "Avval guruhni tanlang"}
            </option>
            {payablesQuery.data?.children.map((c) => (
              <option key={c.childId} value={c.childId} disabled={c.invoices.length === 0}>
                {c.childName}
                {c.invoices.length > 0 ? ` — qarz ${formatMoney(c.balance)}` : " — qarz yo'q"}
              </option>
            ))}
          </Select>
        </div>

        {child && child.invoices.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select
              label="Hisob-faktura (oy)"
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                const inv = child.invoices.find((i) => i.id === e.target.value);
                if (inv) setAmount(String(inv.remaining));
              }}
            >
              {child.invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.period} — {formatMoney(i.remaining)}
                </option>
              ))}
            </Select>
            <Input label="Summa (UZS)" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select label="To'lov usuli" value={method} onChange={(e) => setMethod(e.target.value as CashMethod)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
            <Input label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}

        {invoice && Number(amount) > invoice.remaining + 0.005 && (
          <p className="text-[13px] text-[var(--color-danger)]">Summa qolgan qarzdan ({formatMoney(invoice.remaining)}) katta bo&apos;lmasin</p>
        )}

        <div className="flex justify-end">
          <Button loading={pay.isPending} disabled={!canSubmit} onClick={() => { setError(null); setDone(null); pay.mutate(); }}>
            To&apos;lovni qabul qilish
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
