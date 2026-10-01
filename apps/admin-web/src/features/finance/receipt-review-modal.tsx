"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Payment, PaymentMethod, PaymentReceipt } from "@/lib/types";
import { RECEIPT_PAYMENT_METHODS } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDateTime } from "@/lib/format";
import { useTr } from "@/i18n/tr";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const RECEIPT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  BANK_TRANSFER: "Bank o'tkazmasi",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  MOBILE_APP: "Mobil ilova",
  BANKOMAT: "Bankomat",
};

const REJECT_WARNING =
  "Diqqat: bu chekni rad etsangiz, tizim buni SOXTA CHEK deb qayd etadi. Ota-ona bunday holatni 2 marta takrorlasa, operator qo'ng'iroqlar ro'yxatiga tushadi. Davom etasizmi?";

/**
 * Bitta to'lov yozuvining tafsilotlari — chek (agar bo'lsa), summa, sana,
 * xizmat turi. Hali ko'rib chiqilmagan chek uchun (`receipt` bor, `payment`
 * yo'q, holati PENDING) — usul tanlab Tasdiqlash yoki Otkaz. Otkaz bosilsa
 * izoh yozish shart emas — ogohlantirish bilan bir marta tasdiqlanadi.
 */
export function ReceiptReviewModal({
  open,
  onClose,
  slug,
  childId,
  payment,
  receipt,
  canWrite,
  downloadingReceiptId,
  onDownloadReceipt,
  refundingId,
  onRefund,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  payment?: Payment;
  receipt?: PaymentReceipt;
  canWrite: boolean;
  downloadingReceiptId: string | null;
  onDownloadReceipt: (paymentId: string) => void;
  refundingId?: string;
  onRefund: (paymentId: string) => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>(RECEIPT_PAYMENT_METHODS[0]);
  const [error, setError] = useState<string | null>(null);

  const isPendingReceipt = !payment && receipt?.status === "PENDING";
  const amount = payment ? payment.amount : receipt!.claimedAmount;
  const currency = payment ? payment.currency : receipt!.currency;
  const createdAt = payment ? payment.createdAt : receipt!.createdAt;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-receipts", slug, childId] });
    queryClient.invalidateQueries({ queryKey: ["payments", slug, childId] });
    queryClient.invalidateQueries({ queryKey: ["ledger", slug, childId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
  };

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/app/payment-receipts/${receipt!.id}/approve`, { method }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik")),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/app/payment-receipts/${receipt!.id}/reject`, { comment: "Chek soxta deb rad etildi" }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik")),
  });

  const handleReject = () => {
    if (confirm(REJECT_WARNING)) {
      setError(null);
      rejectMutation.mutate();
    }
  };

  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Modal open={open} onClose={onClose} title={tr("To'lov tafsilotlari")} widthClassName="max-w-lg">
      <div className="space-y-4">
        {receipt && (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-separator)] bg-[var(--color-surface-sunken)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- tashqi manzil */}
            <img
              src={`${API_URL}/app/payment-receipts/${receipt.id}/image`}
              alt={tr("To'lov cheki")}
              className="max-h-[50vh] w-full object-contain"
            />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 text-[14px]">
          <div>
            <dt className="text-[12px] text-[var(--color-text-muted)]">{tr("Sana")}</dt>
            <dd className="font-medium tabular-nums text-[var(--color-text)]">{formatDateTime(createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--color-text-muted)]">{tr("Summa")}</dt>
            <dd className="font-medium tabular-nums text-[var(--color-text)]">{formatMoney(amount, currency)}</dd>
          </div>
          {payment && (
            <div>
              <dt className="text-[12px] text-[var(--color-text-muted)]">{tr("Xizmat turi")}</dt>
              <dd className="font-medium text-[var(--color-text)]">{tr(RECEIPT_METHOD_LABEL[payment.method])}</dd>
            </div>
          )}
          {receipt?.guardian && (
            <div>
              <dt className="text-[12px] text-[var(--color-text-muted)]">{tr("Kim yukladi")}</dt>
              <dd className="font-medium text-[var(--color-text)]">{tr(receipt.guardian.fullName)}</dd>
            </div>
          )}
        </dl>

        {error && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(error)}
          </div>
        )}

        {receipt?.status === "REJECTED" && receipt.reviewNote && (
          <p className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
            {tr(receipt.reviewNote)}
          </p>
        )}

        {isPendingReceipt && !canWrite && (
          <p className="rounded-lg bg-[var(--color-surface-sunken)] px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
            {tr("Bu chekni faqat moliyachi yoki filial admini tasdiqlashi/rad etishi mumkin.")}
          </p>
        )}

        {isPendingReceipt && canWrite && (
          <>
            <Select
              label={tr("Xizmat turi (qanday to'lov qilingan)")}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {RECEIPT_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {tr(RECEIPT_METHOD_LABEL[m])}
                </option>
              ))}
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="danger" loading={rejectMutation.isPending} disabled={pending} onClick={handleReject}>
                {tr("Otkaz")}
              </Button>
              <Button
                type="button"
                loading={approveMutation.isPending}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  approveMutation.mutate();
                }}
              >
                {tr("Tasdiqlash")}
              </Button>
            </div>
          </>
        )}

        {payment && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              loading={downloadingReceiptId === payment.id}
              onClick={() => onDownloadReceipt(payment.id)}
            >
              {tr("Kvitansiya")}
            </Button>
            {canWrite && payment.status === "COMPLETED" && (
              <Button
                size="sm"
                variant="danger"
                loading={refundingId === payment.id}
                onClick={() => {
                  if (confirm(tr("Bu to'lovni qaytarishni tasdiqlaysizmi?"))) {
                    onRefund(payment.id);
                  }
                }}
              >
                {tr("Qaytarish")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
