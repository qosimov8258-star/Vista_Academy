"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { PaymentMethod, ReviewReceiptItem } from "@/lib/types";
import { RECEIPT_PAYMENT_METHODS } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useAuthedImage } from "@/components/ui/child-photo";
import { Row } from "@/components/ios/group";
import { FieldRow } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Pill } from "@/components/ios/pill";
import { IOS } from "@/components/ios/tokens";
import { RECEIPT_METHOD_LABEL } from "@/features/finance/receipt-review-modal";
import { useTr } from "@/i18n/tr";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const RECEIPT_STATUS = {
  PENDING: { label: "Kutilmoqda", color: IOS.orange },
  APPROVED: { label: "Tasdiqlangan", color: IOS.green },
  REJECTED: { label: "Rad etilgan", color: IOS.red },
} as const;

const METHOD_CHOICES: PaymentMethod[] = ["CARD", ...RECEIPT_PAYMENT_METHODS];

const REJECT_REASONS = ["Chek soxta", "Summa mos kelmaydi", "Pul kartaga tushmagan", "Chek o'qilmayapti"];

/** Rad etishni tasdiqlash tugmasi — qizil to'ldirilgan kapsula (xavfli amal) */
function SheetRejectButton({ children, onClick, loading, dim }: { children: React.ReactNode; onClick: () => void; loading?: boolean; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading || undefined}
      className={clsx(
        "flex h-12 w-full items-center justify-center rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:pointer-events-none",
        dim && "opacity-45",
      )}
    >
      {loading ? "..." : children}
    </button>
  );
}

/**
 * Bitta chekni ko'rib chiqish: rasm, summa, ota-ona izohi. Moliyachi
 * pul kartaga haqiqatan tushganini tekshirib tasdiqlaydi (summa bolaning
 * qarzidan ayriladi) yoki sababini yozib rad etadi.
 */
export function ReceiptReviewSheet({
  receipt,
  slug,
  canReview,
  onClose,
}: {
  receipt: ReviewReceiptItem | null;
  slug: string;
  canReview: boolean;
  onClose: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { src, failed } = useAuthedImage(receipt ? `${API_URL}/app/payment-receipts/${receipt.id}/image` : null);

  useEffect(() => {
    setMethod("CARD");
    setRejecting(false);
    setReason("");
    setError(null);
  }, [receipt?.id]);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["review-receipts", slug] });
    queryClient.invalidateQueries({ queryKey: ["payments", slug] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    onClose();
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik"));

  const approve = useMutation({
    mutationFn: () => api.post(`/app/payment-receipts/${receipt!.id}/approve`, { method }),
    onSuccess: done,
    onError: fail,
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/app/payment-receipts/${receipt!.id}/reject`, { comment: reason.trim() }),
    onSuccess: done,
    onError: fail,
  });

  const pending = receipt?.status === "PENDING";
  const busy = approve.isPending || reject.isPending;
  const status = receipt ? RECEIPT_STATUS[receipt.status] : null;

  // Pastki panel: chapda kulrang/xavfli amal, o'ngda asosiy (sheet qoidasi)
  const footer =
    receipt && pending && canReview ? (
      rejecting ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <SheetSecondaryButton onClick={() => setRejecting(false)}>{tr("Orqaga")}</SheetSecondaryButton>
          </div>
          <div className="flex-1">
            <SheetRejectButton
              loading={reject.isPending}
              dim={reason.trim().length < 3}
              onClick={() => {
                if (reason.trim().length < 3) {
                  setError(tr("Rad etish sababini yozing"));
                  return;
                }
                setError(null);
                reject.mutate();
              }}
            >
              {tr("Rad etish")}
            </SheetRejectButton>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1">
            <SheetSecondaryButton
              danger
              onClick={() => {
                if (!busy) setRejecting(true);
              }}
            >
              {tr("Rad etish")}
            </SheetSecondaryButton>
          </div>
          <div className="flex-[1.4]">
            <SheetPrimaryButton
              loading={approve.isPending}
              onClick={() => {
                setError(null);
                approve.mutate();
              }}
            >
              {tr("Tasdiqlash")}
            </SheetPrimaryButton>
          </div>
        </div>
      )
    ) : undefined;

  return (
    <IosSheet open={!!receipt} onClose={onClose} title={tr("To'lov cheki")} footer={footer}>
      {receipt && (
        <div className="space-y-5 pb-2">
          {/* Chek surati */}
          <div className="overflow-hidden rounded-[18px] bg-[#767680]/[0.08]">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- himoyalangan manzil, blob sifatida yuklangan
              <img src={src} alt={tr("To'lov cheki")} className="max-h-[52vh] w-full object-contain" />
            ) : (
              <div className="flex h-44 items-center justify-center text-[13.5px] text-[#8e8e93]">
                {failed ? tr("Chek suratini yuklab bo'lmadi") : tr("Yuklanmoqda...")}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[18px] bg-white">
            <div className="px-4 py-4 text-center">
              <p className="text-[13px] text-[#8e8e93]">{tr("Ota-ona yozgan summa")}</p>
              <p className="mt-0.5 text-[32px] font-bold leading-tight tabular-nums text-[var(--color-text)]">
                {formatMoney(receipt.claimedAmount, receipt.currency)}
              </p>
              {status && (
                <div className="mt-2">
                  <Pill color={status.color}>{tr(status.label)}</Pill>
                </div>
              )}
            </div>
            <Row title={tr("Bola")} value={receipt.child.fullName} subtitle={receipt.child.group?.name} />
            <Row title={tr("Ota-ona")} value={receipt.guardian.fullName} subtitle={receipt.guardian.phone} />
            <Row title={tr("Yuborilgan")} value={formatDateTime(receipt.createdAt)} />
            {receipt.payment && <Row title={tr("To'lov usuli")} value={tr(RECEIPT_METHOD_LABEL[receipt.payment.method])} />}
            {receipt.reviewedBy && (
              <Row title={tr("Ko'rib chiqdi")} value={receipt.reviewedBy.fullName} subtitle={receipt.reviewedAt ? formatDateTime(receipt.reviewedAt) : undefined} />
            )}
          </div>

          {receipt.note && (
            <SheetSection title={tr("Ota-ona izohi")}>
              <p className="px-4 py-3 text-[15px] leading-snug text-[var(--color-text)]">{receipt.note}</p>
            </SheetSection>
          )}

          {receipt.status === "REJECTED" && receipt.reviewNote && (
            <SheetSection title={tr("Rad etish sababi")}>
              <p className="px-4 py-3 text-[15px] leading-snug text-[#ff3b30]">{receipt.reviewNote}</p>
            </SheetSection>
          )}

          {pending && !canReview && (
            <p className="px-4 text-[13px] text-[#8e8e93]">
              {tr("Bu chekni faqat moliyachi yoki filial admini tasdiqlashi/rad etishi mumkin.")}
            </p>
          )}

          {pending && canReview && !rejecting && (
            <SheetSection title={tr("Tasdiqlashdan oldin")} footer={tr("Pul bog'cha kartasiga haqiqatan tushganini tekshiring. Tasdiqlansa, summa shu bolaning qarzidan avtomatik ayriladi.")}>
              <div role="radiogroup" aria-label={tr("To'lov usuli")} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                {METHOD_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={clsx(
                      "flex h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-medium transition-colors active:opacity-60",
                      method === m ? "bg-[var(--color-primary)] text-white" : "bg-[#767680]/[0.12] text-[var(--color-text)]",
                    )}
                  >
                    {method === m && <Check className="h-4 w-4" strokeWidth={2.4} />}
                    {tr(RECEIPT_METHOD_LABEL[m])}
                  </button>
                ))}
              </div>
            </SheetSection>
          )}

          {pending && canReview && rejecting && (
            <SheetSection title={tr("Rad etish sababi")} footer={tr("Sabab ota-onaga ko'rinadi. Soxta chek takrorlansa, administrator qo'ng'iroqlar ro'yxatiga tushadi.")}>
              <div className="flex flex-wrap gap-2 px-4 pt-3">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="rounded-full bg-[#767680]/[0.12] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text)] active:opacity-60"
                  >
                    {tr(r)}
                  </button>
                ))}
              </div>
              <FieldRow label={tr("Sabab")} htmlFor="reject-reason" stacked>
                <textarea
                  id="reject-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full resize-none bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
                  placeholder={tr("Nega rad etilayotganini yozing")}
                />
              </FieldRow>
            </SheetSection>
          )}

          {error && (
            <p role="alert" className="px-4 text-[13px] font-medium text-[#ff3b30]">
              {tr(error)}
            </p>
          )}
        </div>
      )}
    </IosSheet>
  );
}
