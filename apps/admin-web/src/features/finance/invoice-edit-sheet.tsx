"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { FieldRow, FormSection, MoneyInput, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { groupDigits, periodLabel } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";

const digitsOf = (value: string | number) => String(Math.round(Number(value)));

/**
 * Hisob-fakturani tuzatish yoki bekor qilish — faqat moliyachi (API ham
 * shuni tekshiradi). Summa, chegirma va muddat o'zgaradi, sabab majburiy;
 * to'lanishi kerak bo'lgan summa to'langan qismdan kam bo'lmaydi. Bekor
 * qilish — faqat to'lov tushmagan bo'lsa, ikkinchi bosqichda.
 */
export function InvoiceEditSheet({ slug, invoice, onClose }: { slug: string; invoice: Invoice | null; onClose: () => void }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice) return;
    setAmount(digitsOf(invoice.amount));
    setDiscount(digitsOf(invoice.discountAmount));
    setDueDate(invoice.dueDate.slice(0, 10));
    setReason("");
    setCancelling(false);
    setError(null);
  }, [invoice]);

  const done = () => {
    // Hisob-faktura qarz, kassa, moliya xulosasi va bola tarixiga ta'sir qiladi
    queryClient.invalidateQueries();
    onClose();
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/app/invoices/${invoice!.id}`, {
        ...(Number(amount) !== Number(invoice!.amount) ? { amount: Number(amount) } : {}),
        ...(Number(discount || 0) !== Number(invoice!.discountAmount) ? { discountAmount: Number(discount || 0) } : {}),
        ...(dueDate !== invoice!.dueDate.slice(0, 10) ? { dueDate } : {}),
        reason: reason.trim(),
      }),
    onSuccess: done,
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/app/invoices/${invoice!.id}/cancel`, { reason: reason.trim() }),
    onSuccess: done,
    onError: fail,
  });

  const paid = invoice ? Number(invoice.paidAmount) : 0;
  const net = Number(amount || 0) - Number(discount || 0);
  const changed =
    !!invoice &&
    (Number(amount) !== Number(invoice.amount) || Number(discount || 0) !== Number(invoice.discountAmount) || dueDate !== invoice.dueDate.slice(0, 10));
  const tooLow = net < paid - 0.005;
  const reasonOk = reason.trim().length >= 3;
  const busy = save.isPending || cancel.isPending;
  const canCancel = !!invoice && paid <= 0.005;

  return (
    <IosSheet
      open={!!invoice}
      onClose={() => !busy && onClose()}
      cancelLabel="Bekor"
      title={cancelling ? tr("Hisob-fakturani bekor qilish") : tr("Hisob-fakturani tuzatish")}
      footer={
        cancelling ? (
          <div className="flex gap-2">
            <div className="flex-1">
              <SheetSecondaryButton onClick={() => setCancelling(false)}>{tr("Qaytish")}</SheetSecondaryButton>
            </div>
            <div className="flex-1">
              <SheetSecondaryButton danger onClick={() => reasonOk && !busy && cancel.mutate()}>
                {tr(cancel.isPending ? "Bekor qilinmoqda…" : "Bekor qilish")}
              </SheetSecondaryButton>
            </div>
          </div>
        ) : (
          <SheetPrimaryButton dim={!changed || !reasonOk || tooLow || !amount} loading={save.isPending} onClick={() => changed && reasonOk && !tooLow && amount && save.mutate()}>
            {tr("Saqlash")}
          </SheetPrimaryButton>
        )
      }
    >
      {invoice && (
        <>
          <SheetSection>
            <SheetRow label={tr("Bola")}>
              <span className="text-[var(--color-text)]">{tr(invoice.child?.fullName ?? "—")}</span>
            </SheetRow>
            <SheetRow label={tr("Oy")}>
              <span className="text-[var(--color-text)]">{periodLabel(invoice.period, tr)}</span>
            </SheetRow>
            <SheetRow label={tr("To'langan")}>
              <span className="tabular-nums text-[#248a3d]">{groupDigits(paid)} {tr("so'm")}</span>
            </SheetRow>
          </SheetSection>

          {cancelling ? (
            <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] leading-snug text-[#d70015]">
              {tr("Hisob-faktura «bekor qilingan» bo'ladi va qarz yopiladi. U o'chirilmaydi — tarixda sababi bilan qoladi. Buni qaytarib bo'lmaydi.")}
            </p>
          ) : (
            <FormSection
              title={tr("Hisob-faktura")}
              footer={
                tooLow
                  ? tr("To'lanishi kerak bo'lgan summa to'langan {0} so'mdan kam bo'lmaydi.", groupDigits(paid))
                  : tr("To'lanishi kerak: {0} so'm", groupDigits(Math.max(net, 0)))
              }
            >
              <FieldRow label={tr("Summa")} htmlFor="inv-amount">
                <MoneyInput id="inv-amount" value={amount} onChange={setAmount} />
              </FieldRow>
              <FieldRow label={tr("Chegirma")} htmlFor="inv-discount">
                <MoneyInput id="inv-discount" value={discount} onChange={setDiscount} placeholder="0" />
              </FieldRow>
              <FieldRow label={tr("Muddat")} htmlFor="inv-due">
                <TextInput id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-right" />
              </FieldRow>
            </FormSection>
          )}

          <FormSection title={tr("Sabab")} footer={tr("Majburiy — bola tarixida va amallar jurnalida qoladi.")}>
            <div className="px-4">
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder={tr(cancelling ? "Masalan: bola shu oy kelmadi" : "Masalan: import xatosi, summa 2 600 000")}
              />
            </div>
          </FormSection>

          {!cancelling &&
            (canCancel ? (
              <SheetSecondaryButton danger onClick={() => setCancelling(true)}>
                {tr("Hisob-fakturani bekor qilish")}
              </SheetSecondaryButton>
            ) : (
              <p className="px-4 text-[12.5px] leading-snug text-[#8e8e93]">
                {tr("Bu hisob-fakturaga to'lov tushgan — bekor qilish uchun avval to'lovni bekor qiling.")}
              </p>
            ))}

          {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
        </>
      )}
    </IosSheet>
  );
}
