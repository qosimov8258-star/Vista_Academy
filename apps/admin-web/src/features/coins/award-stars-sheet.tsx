"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Star } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

/** API'dagi AwardCoinsDto bilan bir xil: bir martada 1–100 ta (adashib ko'p yozilmasin). */
const MAX_PER_AWARD = 100;
const QUICK = [1, 3, 5, 10];

export interface AwardStarsChild {
  id: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | null;
  avatarUpdatedAt: string | null;
}

/**
 * Tarbiyachi o'z guruhidagi bolaga qo'lda yulduzcha beradi — necha marta
 * berish cheklanmaydi. Bergach bolaning balansi va tarixi yangilanadi.
 */
export function AwardStarsSheet({
  open,
  onClose,
  slug,
  child,
  balance,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  child: AwardStarsChild;
  balance: number | undefined;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");

  // Har safar ochilganda toza holat
  useEffect(() => {
    if (open) {
      setAmount(1);
      setReason("");
    }
  }, [open, child.id]);

  const award = useMutation({
    mutationFn: () =>
      api.post<{ balance: number }>(`/app/coins/children/${child.id}/award`, {
        amount,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coin-children", slug] });
      queryClient.invalidateQueries({ queryKey: ["coin-transactions", child.id] });
      onClose();
    },
  });
  const { reset } = award;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const clamp = (value: number) => Math.min(MAX_PER_AWARD, Math.max(1, Math.round(value) || 1));
  const close = () => !award.isPending && onClose();

  return (
    <IosSheet
      open={open}
      onClose={close}
      title={tr("Yulduzcha berish")}
      footer={
        <SheetPrimaryButton loading={award.isPending} onClick={() => award.mutate()}>
          {tr("{0} ta yulduzcha berish", amount)}
        </SheetPrimaryButton>
      }
    >
      <div className="space-y-5">
        <div className={clsx(GROUP_BLOCK, "flex items-center gap-3 px-4 py-3")}>
          <ChildPhoto child={child} size={48} fallback={initials(child.fullName)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-[var(--color-text)]">{tr(child.fullName)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-[#8e8e93]">
              <Star className="h-3.5 w-3.5" fill={IOS.orange} stroke={IOS.orange} />
              {balance === undefined ? tr("Balans yuklanmoqda…") : tr("Hozir: {0} ta yulduzcha", balance)}
            </p>
          </div>
        </div>

        <div className={clsx(GROUP_BLOCK, "px-4 py-5")}>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setAmount((n) => clamp(n - 1))}
              disabled={amount <= 1}
              aria-label={tr("Kamaytirish")}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#767680]/[0.12] text-[var(--color-text)] transition-opacity active:opacity-60 disabled:cursor-default disabled:opacity-35"
            >
              <Minus className="h-5 w-5" strokeWidth={2.4} />
            </button>
            <div className="flex min-w-[96px] items-center justify-center gap-1.5">
              <Star className="h-7 w-7 shrink-0" fill={IOS.orange} stroke={IOS.orange} />
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(clamp(Number(e.target.value.replace(/\D/g, ""))))}
                aria-label={tr("Yulduzcha soni")}
                className="w-[64px] bg-transparent text-center text-[36px] font-bold tabular-nums text-[var(--color-text)] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setAmount((n) => clamp(n + 1))}
              disabled={amount >= MAX_PER_AWARD}
              aria-label={tr("Ko'paytirish")}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#767680]/[0.12] text-[var(--color-text)] transition-opacity active:opacity-60 disabled:cursor-default disabled:opacity-35"
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(n)}
                aria-pressed={amount === n}
                className={clsx(
                  "h-11 cursor-pointer rounded-full text-[15px] font-semibold tabular-nums transition-colors",
                  amount === n ? "bg-[var(--color-primary)] text-white" : "bg-[#767680]/[0.12] text-[var(--color-text)]",
                )}
              >
                +{n}
              </button>
            ))}
          </div>
        </div>

        <div className={clsx(GROUP_BLOCK, "flex min-h-[52px] items-center gap-3 px-4")}>
          <span className="shrink-0 text-[15px] text-[var(--color-text)]">{tr("Nima uchun")}</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 120))}
            placeholder={tr("Ixtiyoriy, masalan: darsda faol")}
            aria-label={tr("Nima uchun")}
            className="min-w-0 flex-1 bg-transparent py-3 text-right text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c7]"
          />
        </div>

        {award.error && (
          <p className="px-4 text-[13px] text-[var(--color-danger)]">
            {award.error instanceof ApiError ? tr(award.error.message) : tr("Berib bo'lmadi")}
          </p>
        )}
        <p className="px-4 text-[13px] text-[#8e8e93]">{tr("Ota-ona yulduzchalarni kabinetida ko'radi va do'konda ishlatadi.")}</p>
      </div>
    </IosSheet>
  );
}
