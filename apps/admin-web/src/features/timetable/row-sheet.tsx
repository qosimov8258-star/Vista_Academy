"use client";

import { useEffect, useState } from "react";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, TextInput } from "@/components/ios/form";
import { Spinner } from "@/components/ios/spinner";
import { useTr } from "@/i18n/tr";
import { DAY_LONG, emptyCells, type TimetableRow } from "./shared";

const MAX_TITLE = 80;

/**
 * Jadval qatori: vaqt oralig'i va har kun uchun mashg'ulot nomi.
 * Bo'sh qoldirilgan kun — o'sha kuni bu vaqtda mashg'ulot yo'q.
 * O'chirish — varaq ichida ikkinchi bosqich bilan tasdiqlanadi.
 */
export function RowSheet({
  open,
  onClose,
  row,
  focusDay,
  takenTimes,
  saving,
  error,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  /** null — yangi qator */
  row: TimetableRow | null;
  /** Katak bosib ochilganda o'sha kun maydoni fokuslanadi */
  focusDay: number | null;
  /** Boshqa qatorlarning "boshlanish|tugash" kalitlari — takror bo'lmasin */
  takenTimes: string[];
  saving: boolean;
  error: string | null;
  onSave: (row: TimetableRow) => void;
  onDelete: () => void;
}) {
  const tr = useTr();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cells, setCells] = useState<string[]>(emptyCells());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStart(row?.startTime ?? "");
    setEnd(row?.endTime ?? "");
    setCells(row ? [...row.cells] : emptyCells());
    setConfirmDelete(false);
    setTried(false);
  }, [open, row]);

  const timeError = !start
    ? "Boshlanish vaqtini kiriting"
    : end && end <= start
      ? "Tugash vaqti boshlanishidan keyin bo'lsin"
      : takenTimes.includes(`${start}|${end}`)
        ? "Bu vaqt jadvalda allaqachon bor"
        : null;
  const filled = cells.some((c) => c.trim());
  const valid = !timeError && filled;

  const setCell = (index: number, value: string) => setCells((prev) => prev.map((c, i) => (i === index ? value.slice(0, MAX_TITLE) : c)));
  // Dushanbadagi (yoki birinchi to'ldirilgan) mashg'ulotni ish kunlariga yoyish
  const source = cells.find((c) => c.trim()) ?? "";
  const fillWeek = () => setCells((prev) => prev.map((c, i) => (i < 6 ? source : c)));

  const submit = () => {
    setTried(true);
    if (!valid || saving) return;
    onSave({ startTime: start, endTime: end, cells: cells.map((c) => c.trim()) });
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !saving && onClose()}
      title={row ? tr("Qatorni tahrirlash") : tr("Yangi qator")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={saving} dim={!valid}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <FormSection title={tr("Vaqt")} footer={tried && timeError ? <span className="text-[#ff3b30]">{tr(timeError)}</span> : undefined}>
        <FieldRow label={tr("Boshlanishi")} htmlFor="tt-start">
          <input
            id="tt-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full bg-transparent py-3 text-right text-[15px] tabular-nums text-[var(--color-text)] outline-none"
          />
        </FieldRow>
        <FieldRow label={tr("Tugashi")} htmlFor="tt-end">
          <input
            id="tt-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full bg-transparent py-3 text-right text-[15px] tabular-nums text-[var(--color-text)] outline-none"
          />
        </FieldRow>
      </FormSection>

      <FormSection
        title={tr("Mashg'ulot")}
        footer={
          tried && !filled ? (
            <span className="text-[#ff3b30]">{tr("Kamida bitta kun uchun mashg'ulot yozing")}</span>
          ) : (
            tr("Bo'sh qoldirilgan kuni bu vaqtda mashg'ulot yo'q. Jadval ota-onalar kabinetida ham ko'rinadi.")
          )
        }
      >
        {DAY_LONG.map((day, index) => (
          <FieldRow key={day} label={tr(day)} htmlFor={`tt-day-${index}`}>
            <TextInput
              id={`tt-day-${index}`}
              value={cells[index]}
              onChange={(e) => setCell(index, e.target.value)}
              autoFocus={open && focusDay === index}
              placeholder={index === 6 ? tr("Dam olish kuni") : tr("Masalan: Ingliz tili")}
              autoComplete="off"
              className="text-right"
            />
          </FieldRow>
        ))}
        {source && (
          <button
            type="button"
            onClick={fillWeek}
            className="group/row relative flex min-h-[48px] w-full items-center px-4 text-left text-[15px] text-[var(--color-primary)] transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
          >
            <span className="truncate">{tr("«{0}» ni Du–Sha ga qo'yish", source.trim())}</span>
            <span className="pointer-events-none absolute left-4 right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />
          </button>
        )}
      </FormSection>

      {error && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {tr(error)}
        </p>
      )}

      {row &&
        (confirmDelete ? (
          <section className="space-y-3 rounded-[18px] bg-[#ff3b30]/[0.08] px-4 py-3.5">
            <p className="text-[13.5px] leading-snug text-[#ff3b30]">{tr("Bu qator jadvaldan o'chiriladi. Kundalikdagi o'tgan kunlar belgilari saqlanib qoladi.")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
                className="h-11 flex-1 rounded-full bg-white text-[15px] font-semibold text-[var(--color-text)] transition-transform active:scale-[0.97]"
              >
                {tr("Qoldirish")}
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={saving}
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                {saving ? <Spinner className="h-4 w-4 text-white" /> : tr("O'chirish")}
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-12 w-full items-center justify-center rounded-[18px] bg-white text-[16px] text-[#ff3b30] transition-colors active:bg-[#767680]/[0.1]"
          >
            {tr("Qatorni o'chirish")}
          </button>
        ))}
    </IosSheet>
  );
}
