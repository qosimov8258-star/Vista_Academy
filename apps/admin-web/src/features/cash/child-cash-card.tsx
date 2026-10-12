"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { currentMonth, todayTashkent } from "./shared";
import { useTr } from "@/i18n/tr";

interface Payable {
  childId: string;
  childName: string;
  balance: number;
  invoices: { id: string; period: string; remaining: number; dueDate: string }[];
}

type ChildMethod = "CASH" | "PAYME" | "CLICK" | "MOBILE_APP" | "OTHER";
const CHILD_METHODS: { value: ChildMethod; label: string }[] = [
  { value: "CASH", label: "Naqd" },
  { value: "PAYME", label: "Payme" },
  { value: "CLICK", label: "Click" },
  { value: "MOBILE_APP", label: "Ilova" },
  { value: "OTHER", label: "Boshqa" },
];

/** Summa ming'liklarga bo'lib ko'rsatiladi: 1000000 → "1 000 000". */
function formatAmountInput(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Chek suratini brauzerda kichraytirib, data URL qiladi (server 3MB gacha qabul qiladi). */
function prepareReceiptPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Rasmni qayta ishlab bo'lmadi"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
}

/**
 * Bola sahifasidagi kassa: avval shu bolaning qarzi ko'rinadi, keyin summa
 * kiritilib to'lov turi tanlanadi. Naqddan boshqa turlarda kassir chekni rasmga
 * olib shu yerga joylaydi.
 * Ota-ona to'lov qilgani kelganda kassir shu yerning o'zida ishlaydi.
 */
export function ChildCashCard({ slug, groupId, childId }: { slug: string; groupId: string; childId: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ChildMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ paymentId: string; text: string; photoFailed: boolean } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Naqddan boshqa har bir to'lovda chek surati majburiy
  const needsPhoto = method !== "CASH";

  const payablesQuery = useQuery({
    queryKey: ["cash-payables", slug, groupId],
    queryFn: () => api.get<{ children: Payable[] }>(`/app/cash/payables/${groupId}`),
  });
  const child = payablesQuery.data?.children.find((c) => c.childId === childId);
  const invoices = child?.invoices ?? [];
  const invoice = invoices.find((i) => i.id === invoiceId);

  // Eng eski qarz avtomatik tanlanadi va summa shu qarzga to'ldiriladi.
  const firstInvoiceId = invoices[0]?.id ?? "";
  const firstRemaining = invoices[0]?.remaining;
  useEffect(() => {
    setInvoiceId(firstInvoiceId);
    setAmount(firstRemaining !== undefined ? String(Math.round(firstRemaining)) : "");
  }, [firstInvoiceId, firstRemaining]);

  const pay = useMutation({
    mutationFn: async () => {
      let targetInvoiceId = invoiceId;
      // Qarz yo'q bo'lsa — kiritilgan summa uchun joriy oyga hisob-faktura ochiladi
      // va to'lov shunga yoziladi (to'lov faqat hisob-fakturaga bog'lanadi).
      if (!targetInvoiceId) {
        const created = await api.post<{ id: string }>("/app/invoices", {
          childId,
          amount: Number(amount),
          period: currentMonth(),
          dueDate: todayTashkent(),
        });
        targetInvoiceId = created.id;
      }
      const res = await api.post<{ payment: { id: string } }>("/app/payments", {
        invoiceId: targetInvoiceId,
        amount: Number(amount),
        method,
      });
      // To'lov yozildi — chek rasmi yuklanmasa ham to'lov yo'qolmaydi, qayta urinish mumkin
      let photoFailed = false;
      if (needsPhoto && photo) {
        try {
          await api.post(`/app/payments/${res.payment.id}/receipt-image`, { image: photo });
        } catch {
          photoFailed = true;
        }
      }
      return { paymentId: res.payment.id, photoFailed };
    },
    onSuccess: (res) => {
      setError(null);
      setDone({
        paymentId: res.paymentId,
        photoFailed: res.photoFailed,
        text: `${formatMoney(Number(amount))} (${CHILD_METHODS.find((m) => m.value === method)?.label}) qabul qilindi`,
      });
      if (!res.photoFailed) setPhoto(null);
      for (const key of ["cash-day", "cash-payables", "cash-groups", "cash-group-children", "invoices", "ledger", "child"]) {
        queryClient.invalidateQueries({ queryKey: [key, slug] });
      }
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const retryPhoto = async () => {
    if (!done || !photo) return;
    setRetrying(true);
    try {
      await api.post(`/app/payments/${done.paymentId}/receipt-image`, { image: photo });
      setDone({ ...done, photoFailed: false });
      setPhoto(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tr("Chekni yuklab bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setRetrying(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPhotoBusy(true);
    try {
      setPhoto(await prepareReceiptPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Rasmni o'qib bo'lmadi"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const tooMuch = !!invoice && Number(amount) > invoice.remaining + 0.005;
  const canSubmit = Number(amount) > 0 && !tooMuch && (!needsPhoto || !!photo) && !photoBusy;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{tr("Kassa")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {payablesQuery.isLoading ? (
          <LoadingState rows={2} />
        ) : (
          <>
            {/* 1. Qarz — kassir birinchi shuni ko'radi */}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface-sunken)] px-4 py-3">
              <span className="text-[13px] text-[var(--color-text-muted)]">{tr("Jami qarz")}</span>
              <span
                className={`text-[22px] font-semibold tabular-nums ${
                  (child?.balance ?? 0) > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"
                }`}
              >
                {formatMoney(child?.balance ?? 0)}
              </span>
            </div>

            {error && <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{tr(error)}</div>}
            {done && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">
                <span>{tr(done.text)}</span>
                {done.photoFailed && (
                  <Button size="sm" variant="outline" loading={retrying} onClick={retryPhoto}>
                    {tr("Chekni qayta joylash")}
                  </Button>
                )}
              </div>
            )}

            {invoices.length > 0 && (
              <ul className="divide-y divide-[var(--color-separator)] overflow-hidden rounded-2xl border border-[var(--color-separator)]">
                {invoices.map((i) => {
                  const selected = i.id === invoiceId;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setInvoiceId(i.id);
                          setAmount(String(i.remaining));
                          setDone(null);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-[14px] ${
                          selected ? "bg-[var(--color-primary)]/10 font-semibold" : ""
                        }`}
                      >
                        <span>{tr(i.period)}</span>
                        <span className="tabular-nums">{formatMoney(i.remaining)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* 2. Summa va to'lov turi yonma-yon */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem]">
              <Input
                label={tr("To'lov summasi (UZS)")}
                type="text"
                inputMode="numeric"
                value={formatAmountInput(amount)}
                placeholder={invoices.length === 0 ? tr("Qancha to'laydi") : undefined}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
              />
              <Select label={tr("To'lov turi")} value={method} onChange={(e) => setMethod(e.target.value as ChildMethod)}>
                {CHILD_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {tr(m.label)}
                  </option>
                ))}
              </Select>
            </div>

            {needsPhoto && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--color-separator)] px-4 py-3">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={tr("Chek surati")} className="h-16 w-16 rounded-lg object-cover" />
                ) : null}
                <div className="min-w-0 flex-1 basis-[10rem]">
                  <p className="text-[14px] font-medium text-[var(--color-text)]">{tr("Chek surati")}</p>
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">
                    {photo ? tr("Chek tanlandi") : tr("To'lov chekini rasmga oling va shu yerga joylang")}
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void pickPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant="outline" loading={photoBusy} onClick={() => fileRef.current?.click()}>
                  {photo ? tr("Almashtirish") : tr("Chekni joylash")}
                </Button>
              </div>
            )}

            {invoices.length === 0 && (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                {tr("Qarz yo'q — kiritilgan summa joriy oy uchun to'lov sifatida yoziladi")}
              </p>
            )}

            {tooMuch && invoice && (
              <p className="text-[13px] text-[var(--color-danger)]">
                {tr("Summa qolgan qarzdan (")}
                {formatMoney(invoice.remaining)}
                {tr(") katta bo'lmasin")}
              </p>
            )}

            {/* 3. Qabul qilish → chek */}
            <div className="flex justify-end">
              <Button
                loading={pay.isPending}
                disabled={!canSubmit}
                onClick={() => {
                  setError(null);
                  setDone(null);
                  pay.mutate();
                }}
              >
                {tr("To'lovni qabul qilish")}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
