"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { PaymentCardInfo } from "@/lib/types";
import { FieldRow, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { useTr } from "@/i18n/tr";
import { CardVisual, formatCardNumber } from "./card-visual";

/**
 * To'lov kartasini kiritish/o'zgartirish varag'i. Tepada karta jonli
 * ko'rinishda — moliyachi ota-onalar aynan shuni ko'rishini ko'radi.
 */
export function PaymentCardSheet({
  open,
  onClose,
  slug,
  card,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  card: PaymentCardInfo | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Har ochilganda saqlangan qiymatlar bilan boshlanadi
  useEffect(() => {
    if (!open) return;
    setNumber(card ? formatCardNumber(card.cardNumber) : "");
    setHolder(card?.holderName ?? "");
    setBank(card?.bankName ?? "");
    setNote(card?.note ?? "");
    setError(null);
  }, [open, card]);

  const digits = number.replace(/\D/g, "");

  const save = useMutation({
    mutationFn: () =>
      api.put<PaymentCardInfo>("/app/payment-card", {
        cardNumber: digits,
        holderName: holder.trim(),
        bankName: bank.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-card", slug] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik")),
  });

  const submit = () => {
    if (digits.length !== 16) {
      setError(tr("Karta raqami 16 ta raqamdan iborat bo'lishi kerak"));
      return;
    }
    if (holder.trim().length < 2) {
      setError(tr("Karta egasining ismini kiriting"));
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={tr("To'lov kartasi")}
      footer={
        <SheetPrimaryButton loading={save.isPending} onClick={submit}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <div className="space-y-5 pb-2">
        <CardVisual cardNumber={digits.padEnd(16, "•")} holderName={holder.trim() || tr("KARTA EGASI")} bankName={bank.trim() || null} />

        <SheetSection
          footer={tr("Bu karta barcha ota-onalarning kabinetida ko'rinadi — ular shu kartaga pul o'tkazadi.")}
        >
          <FieldRow label={tr("Karta raqami")} htmlFor="card-number">
            <TextInput
              id="card-number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000 0000 0000 0000"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value.slice(0, 19)))}
              className="tabular-nums tracking-wide"
            />
          </FieldRow>
          <FieldRow label={tr("Karta egasi")} htmlFor="card-holder">
            <TextInput id="card-holder" placeholder="ISMOILOV ALISHER" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={80} />
          </FieldRow>
          <FieldRow label={tr("Bank")} htmlFor="card-bank">
            <TextInput id="card-bank" placeholder={tr("Masalan, Xalq banki")} value={bank} onChange={(e) => setBank(e.target.value)} maxLength={60} />
          </FieldRow>
          <FieldRow label={tr("Izoh")} htmlFor="card-note">
            <TextInput id="card-note" placeholder={tr("Ota-onaga ko'rsatma (ixtiyoriy)")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </FieldRow>
        </SheetSection>

        {error && (
          <p role="alert" className="px-4 text-[13px] font-medium text-[#ff3b30]">
            {tr(error)}
          </p>
        )}
      </div>
    </IosSheet>
  );
}
