"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Subscription } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";

/** Pul yoki obuna o'zgarganda yangilanadigan so'rovlar. */
function useInvalidateBilling(organizationId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["wallet", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["billing"] });
  };
}

const MONTH_OPTIONS = [1, 3, 6, 12];

/**
 * Obunani N oyga uzaytirish: hamyondan (narx × oy) yechib yoki bepul
 * (kompensatsiya, kelishuv). Davr hozirgi muddat tugashidan davom etadi.
 */
export function ExtendSubscriptionModal({
  open,
  onClose,
  organizationId,
  subscription,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  subscription: Subscription;
  balance: number;
}) {
  const invalidate = useInvalidateBilling(organizationId);
  const [months, setMonths] = useState(1);
  const [charge, setCharge] = useState(true);
  useEffect(() => {
    if (open) {
      setMonths(1);
      setCharge(true);
    }
  }, [open]);

  const price = Number(subscription.plan?.priceMonthly ?? 0);
  const total = price * months;
  const enough = !charge || balance >= total;

  const mutation = useMutation({
    mutationFn: () => api.post(`/platform/subscriptions/organization/${organizationId}/extend`, { months, charge }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={() => !mutation.isPending && onClose()} title="Obunani uzaytirish">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-[var(--color-text)]">Muddat</p>
          <div className="grid grid-cols-4 gap-2">
            {MONTH_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMonths(value)}
                aria-pressed={months === value}
                className={clsx(
                  "h-11 cursor-pointer rounded-[14px] text-[14px] font-semibold transition-colors",
                  months === value ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
                )}
              >
                {value} oy
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium text-[var(--color-text)]">To&apos;lov</p>
          {[
            { value: true, title: "Hamyondan yechish", hint: `${formatMoney(total)} yechiladi · hamyonda ${formatMoney(balance)}` },
            { value: false, title: "Bepul uzaytirish", hint: "Kompensatsiya yoki alohida kelishuv — pul yechilmaydi" },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={clsx(
                "flex cursor-pointer items-start gap-3 rounded-[16px] border px-4 py-3 transition-colors",
                charge === option.value ? "border-[var(--color-ink)] bg-[var(--color-surface-sunken)]" : "border-[var(--color-border)]",
              )}
            >
              <input
                type="radio"
                name="charge"
                checked={charge === option.value}
                onChange={() => setCharge(option.value)}
                className="mt-1 accent-[var(--color-ink)]"
              />
              <span>
                <span className="block text-[14px] font-medium text-[var(--color-text)]">{option.title}</span>
                <span className="block text-[12.5px] text-[var(--color-text-muted)]">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {!enough && (
          <p className="rounded-[14px] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]">
            Hamyonda {formatMoney(total - balance)} yetmaydi — avval to&apos;ldiring yoki bepul uzaytiring.
          </p>
        )}
        {mutation.error && (
          <p className="text-[13px] text-[var(--color-danger)]">
            {mutation.error instanceof ApiError ? mutation.error.message : "Kutilmagan xatolik"}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button disabled={!enough} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {months} oyga uzaytirish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const ADJUST_TYPES = [
  { value: "BONUS", label: "Bonus", hint: "Hamyonga sovg'a mablag'" },
  { value: "REFUND", label: "Qaytarish", hint: "Ortiqcha yechilgan to'lovni qaytarish" },
  { value: "ADJUSTMENT", label: "Tuzatish", hint: "Xato kiritilgan summani to'g'rilash (+ yoki −)" },
] as const;

/** Hamyonni tuzatish: bonus, qaytarish yoki qo'lda to'g'rilash (manfiy ham bo'lishi mumkin). */
export function AdjustWalletModal({ open, onClose, organizationId }: { open: boolean; onClose: () => void; organizationId: string }) {
  const invalidate = useInvalidateBilling(organizationId);
  const [type, setType] = useState<(typeof ADJUST_TYPES)[number]["value"]>("BONUS");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setType("BONUS");
      setDirection(1);
      setAmount("");
      setNote("");
    }
  }, [open]);

  const value = Number(amount.replace(/\s/g, ""));
  const valid = Number.isFinite(value) && value > 0;
  const signed = type === "ADJUSTMENT" ? value * direction : value;

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/platform/organizations/${organizationId}/wallet/adjust`, { type, amount: signed, note: note.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={() => !mutation.isPending && onClose()} title="Hamyonni tuzatish">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {ADJUST_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              aria-pressed={type === option.value}
              className={clsx(
                "h-11 cursor-pointer rounded-[14px] text-[13.5px] font-semibold transition-colors",
                type === option.value ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">{ADJUST_TYPES.find((option) => option.value === type)?.hint}</p>

        {type === "ADJUSTMENT" && (
          <div className="grid grid-cols-2 gap-2">
            {([1, -1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setDirection(dir)}
                aria-pressed={direction === dir}
                className={clsx(
                  "h-10 cursor-pointer rounded-[12px] text-[13px] font-medium transition-colors",
                  direction === dir ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-text)]",
                )}
              >
                {dir === 1 ? "+ Qo'shish" : "− Ayirish"}
              </button>
            ))}
          </div>
        )}

        <Input label="Summa (so'm)" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="100000" />
        <Input label="Izoh" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Masalan: aprel oyi uchun kompensatsiya" maxLength={300} />

        {mutation.error && (
          <p className="text-[13px] text-[var(--color-danger)]">
            {mutation.error instanceof ApiError ? mutation.error.message : "Kutilmagan xatolik"}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {valid ? `${signed > 0 ? "+" : "−"}${formatMoney(Math.abs(signed))}` : "Saqlash"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
