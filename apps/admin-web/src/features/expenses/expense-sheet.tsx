"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Lock, Pencil, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { DayStepper, WEEKDAYS, dayMonthLabel } from "@/components/ios/day-stepper";
import { Spinner } from "@/components/ios/spinner";
import { GROUP_BLOCK, SECTION_TITLE } from "@/components/ios/tokens";
import { Toast, type ToastState } from "@/components/ui/toast";
import { useAuthedImage } from "@/components/ui/child-photo";
import { ReceiptPicker } from "@/features/payments/payment-sheet";
import { todayTashkent } from "@/features/cash/shared";
import { METHOD_COLOR, METHOD_LABEL, groupDigits, prepareReceiptPhoto } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, categoryMeta, type ExpenseRow } from "./categories";

const FILL = "bg-[#767680]/[0.12]";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const receiptUrl = (id: string) => `${API_URL}/app/cash/expenses/${id}/receipt-image`;

/** Saqlangan chek surati (blob orqali, token bilan) */
function SavedReceipt({ expenseId, className }: { expenseId: string; className?: string }) {
  const tr = useTr();
  const image = useAuthedImage(receiptUrl(expenseId));
  if (image.src) {
    // eslint-disable-next-line @next/next/no-img-element -- blob URL
    return <img src={image.src} alt={tr("Chek")} className={className} />;
  }
  return (
    <span className={clsx("flex items-center justify-center text-[13px] text-[#8e8e93]", className)}>
      {image.failed ? tr("Chekni yuklab bo'lmadi") : <Spinner className="h-5 w-5" />}
    </span>
  );
}

export type ExpenseSheetRequest = { kind: "new"; date?: string } | { kind: "view"; expense: ExpenseRow } | null;

type Mode = { kind: "form"; editing: ExpenseRow | null } | { kind: "view"; expense: ExpenseRow } | { kind: "confirm"; expense: ExpenseRow };

/** 30/32px turkum plitkasi — tekis tizim rangi + oq ikonka */
export function CategoryTile({ category, size = 30 }: { category: string; size?: number }) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  return (
    <span
      className={clsx("flex shrink-0 items-center justify-center text-white", size >= 40 ? "rounded-[12px]" : "rounded-[8px]")}
      style={{ width: size, height: size, backgroundColor: meta.color }}
      aria-hidden="true"
    >
      <Icon style={{ width: size / 2, height: size / 2 }} strokeWidth={2.2} />
    </span>
  );
}

/** "13-oktabr, dushanba" */
export function expenseDayLabel(date: string, tr: (key: string) => string, today: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const year = new Date(`${today}T00:00:00Z`).getUTCFullYear();
  const prefix = date === today ? tr("Bugun") : tr(WEEKDAYS[d.getUTCDay()]);
  return `${prefix}, ${dayMonthLabel(date, tr, year)}`;
}

/**
 * Xarajat varag'i — qo'shish, ko'rish, tahrirlash va o'chirish (Sabot ERP
 * uslubida, hammasi bitta varaq ichida). Forma: katta summa, turkum
 * plitkalari (4 ustun), qanday to'langani (sukut — naqd; faqat naqd kassani
 * kamaytiradi), sana (kelajak emas) va izoh. O'chirish — varaq ichida
 * ikkinchi bosqich. Kassa yopilgan kundagi yozuv faqat ko'rinadi.
 */
export function ExpenseSheet({ request, onClose }: { request: ExpenseSheetRequest; onClose: () => void }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const open = request !== null;
  const [mode, setMode] = useState<Mode>({ kind: "form", editing: null });
  const [today, setToday] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Tahrirlashda saqlangan chek qoldiriladi (almashtirilmaguncha)
  const [keepSaved, setKeepSaved] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const fillForm = (row: ExpenseRow | null, day?: string) => {
    const t = todayTashkent();
    setToday(t);
    setAmount(row ? String(Math.round(row.amount)) : "");
    setCategory(row?.category ?? null);
    setMethod(row?.method ?? "CASH");
    setDate(row?.date ?? (day && day <= t ? day : t));
    setNote(row?.note ?? "");
    setPhoto(null);
    setKeepSaved(!!row?.hasReceiptImage);
    setShowMissing(false);
    setError(null);
  };

  // Har ochilishda toza holat
  useEffect(() => {
    if (!request) return;
    if (request.kind === "new") {
      fillForm(null, request.date);
      setMode({ kind: "form", editing: null });
    } else {
      setToday(todayTashkent());
      setError(null);
      setMode({ kind: "view", expense: request.expense });
    }
  }, [request]);

  const value = Number(amount || 0);
  const needsPhoto = method !== "CASH";
  const editingRow = mode.kind === "form" ? mode.editing : null;
  const hasSaved = keepSaved && !!editingRow?.hasReceiptImage;
  const missing = value <= 0 ? "Summani kiriting" : !category ? "Turkumni tanlang" : needsPhoto && !photo && !hasSaved ? "Chekni qo'shing" : null;

  const takePhoto = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(tr("Faqat rasm (JPG, PNG) yuklash mumkin"));
      return;
    }
    setPhotoBusy(true);
    try {
      setPhoto(await prepareReceiptPhoto(file));
      setError(null);
    } catch (e) {
      setError(tr(e instanceof Error ? e.message : "Rasmni o'qib bo'lmadi"));
    } finally {
      setPhotoBusy(false);
    }
  };
  const takePhotoRef = useRef(takePhoto);
  takePhotoRef.current = takePhoto;
  // Ctrl+V bilan chek rasmini qo'yish
  useEffect(() => {
    if (!open || mode.kind !== "form" || !needsPhoto) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        event.preventDefault();
        void takePhotoRef.current(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, mode.kind, needsPhoto]);

  const done = (message: string) => {
    setToast({ type: "success", message: tr(message) });
    onClose();
    // Ro'yxat, kassa kuni va hisobot fonda yangilanadi — varaq kutmaydi
    void queryClient.invalidateQueries();
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));

  const save = useMutation({
    mutationFn: (editing: ExpenseRow | null) => {
      const body = { date, amount: value, category, method, note: note.trim() || undefined, receiptImage: needsPhoto && photo ? photo : undefined };
      return editing ? api.patch(`/app/cash/expenses/${editing.id}`, body) : api.post("/app/cash/expenses", body);
    },
    onSuccess: (_res, editing) => done(editing ? "Xarajat saqlandi" : "Xarajat qo'shildi"),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/app/cash/expenses/${id}`),
    onSuccess: () => done("Xarajat o'chirildi"),
    onError: fail,
  });
  const busy = save.isPending || remove.isPending;

  const back = () => {
    if (busy) return;
    setError(null);
    if (mode.kind === "confirm") setMode({ kind: "view", expense: mode.expense });
    else if (mode.kind === "form" && mode.editing) setMode({ kind: "view", expense: mode.editing });
    else onClose();
  };
  const isRoot = (mode.kind === "form" && !mode.editing) || mode.kind === "view";

  let title: ReactNode;
  let body: ReactNode;
  let footer: ReactNode;

  if (mode.kind === "form") {
    const editing = mode.editing;
    title = editing ? tr("Xarajatni tahrirlash") : tr("Xarajat qo'shish");
    body = (
      <>
        <section>
          <h3 className={SECTION_TITLE}>{tr("Summa")}</h3>
          <label className={clsx("flex h-14 items-center gap-2 rounded-[14px] bg-white px-4", showMissing && value <= 0 && "ring-2 ring-[#ff3b30]")}>
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-label={tr("Summa")}
              value={amount ? groupDigits(amount) : ""}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 11))}
              className="min-w-0 flex-1 bg-transparent text-[24px] font-bold tabular-nums text-[var(--color-text)] outline-none placeholder:text-[#c7c7cc]"
            />
            <span className="shrink-0 text-[15px] font-semibold text-[#8e8e93]">{tr("so'm")}</span>
          </label>
        </section>

        <section>
          <h3 className={clsx(SECTION_TITLE, showMissing && !category && "!text-[#ff3b30]")}>{tr("Turkum")}</h3>
          <div role="radiogroup" aria-label={tr("Turkum")} className="grid grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map((c) => {
              const active = category === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategory(c.name)}
                  className={clsx(
                    "flex min-w-0 flex-col items-center gap-1.5 rounded-[14px] bg-white px-1 py-2.5 transition-transform active:scale-[0.96]",
                    active && "ring-2 ring-[var(--color-primary)]",
                  )}
                >
                  <CategoryTile category={c.name} size={32} />
                  <span className={clsx("line-clamp-2 flex min-h-[2lh] w-full items-start justify-center text-center text-[12px] leading-tight text-[var(--color-text)]", active && "font-semibold")}>{tr(c.name)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className={SECTION_TITLE}>{tr("Qanday to'landi")}</h3>
          <div className={clsx(GROUP_BLOCK, "p-3")}>
            <div role="radiogroup" aria-label={tr("To'lov usuli")} className="grid grid-cols-3 gap-2">
              {EXPENSE_METHODS.map((m) => {
                const active = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMethod(m)}
                    className={clsx(
                      "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-1.5 text-[14px] font-semibold transition-transform active:scale-[0.96] sm:text-[15px]",
                      active ? "bg-[var(--color-primary)] text-white" : clsx(FILL, "text-[var(--color-text)]"),
                    )}
                  >
                    {!active && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: METHOD_COLOR[m] }} aria-hidden="true" />}
                    <span className="truncate">{tr(METHOD_LABEL[m])}</span>
                  </button>
                );
              })}
            </div>
            <p className="px-1 pt-2.5 text-[12.5px] leading-snug text-[#8e8e93]">
              {method === "CASH" ? tr("Naqd xarajat kassadagi pulni kamaytiradi") : tr("Kassadagi naqd pulga ta'sir qilmaydi")}
            </p>
            {/* Naqddan boshqa usulda chek surati majburiy */}
            {needsPhoto && (
              <div className="pt-3">
                {hasSaved && !photo && editingRow ? (
                  <div className={clsx("flex items-center gap-3 rounded-[14px] p-2 pr-3", FILL)}>
                    <SavedReceipt expenseId={editingRow.id} className="h-14 w-14 shrink-0 rounded-[10px] object-cover" />
                    <span className="min-w-0 flex-1 text-[15px] text-[var(--color-text)]">{tr("Saqlangan chek")}</span>
                    <button
                      type="button"
                      onClick={() => setKeepSaved(false)}
                      aria-label={tr("Chekni almashtirish")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.2] text-[#3c3c43] transition-transform active:scale-90"
                    >
                      <X className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <ReceiptPicker photo={photo} busy={photoBusy} invalid={showMissing && !photo} onPick={takePhoto} onClear={() => setPhoto(null)} />
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className={clsx(GROUP_BLOCK, "space-y-3 p-4")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] text-[var(--color-text)]">{tr("Sana")}</span>
              {date && today && <DayStepper value={date} onChange={setDate} today={today} max={today} />}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder={tr("Izoh (ixtiyoriy) — masalan, oktabr ijarasi")}
              className={clsx("h-11 w-full rounded-[12px] px-3.5 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#8e8e93]", FILL)}
            />
          </div>
          {error && <p className="px-4 pt-2 text-[13px] text-[#ff3b30]">{error}</p>}
        </section>
      </>
    );
    footer = (
      <SheetPrimaryButton
        onClick={() => {
          if (missing) {
            setShowMissing(true);
            return;
          }
          setError(null);
          save.mutate(editing);
        }}
        loading={save.isPending}
        dim={!!missing}
      >
        {missing ? tr(missing) : `${tr("Saqlash")} · ${groupDigits(value)} ${tr("so'm")}`}
      </SheetPrimaryButton>
    );
  } else if (mode.kind === "view") {
    const e = mode.expense;
    title = e.note || tr(e.category);
    body = (
      <>
        <div className="flex flex-col items-center gap-2 pt-1">
          <CategoryTile category={e.category} size={48} />
          <span className="text-[32px] font-bold tabular-nums text-[var(--color-text)]">
            {groupDigits(e.amount)} <span className="text-[17px] font-semibold">{tr("so'm")}</span>
          </span>
        </div>
        <SheetSection>
          <SheetRow label={tr("Turkum")}>{tr(e.category)}</SheetRow>
          <SheetRow label={tr("Usul")}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_COLOR[e.method] }} aria-hidden="true" />
              {tr(METHOD_LABEL[e.method])}
            </span>
          </SheetRow>
          <SheetRow label={tr("Sana")}>{today ? expenseDayLabel(e.date, tr, today) : e.date}</SheetRow>
          <SheetRow label={tr("Kim yozgan")}>{e.createdByName}</SheetRow>
          <SheetRow label={tr("Yozilgan")}>{formatDateTime(e.createdAt)}</SheetRow>
          {e.note && <SheetRow label={tr("Izoh")}>{e.note}</SheetRow>}
        </SheetSection>
        {e.hasReceiptImage && (
          <SheetSection title={tr("Chek")}>
            <SavedReceipt expenseId={e.id} className="max-h-[50vh] min-h-40 w-full object-contain" />
          </SheetSection>
        )}
        {e.locked && (
          <p className="flex items-center gap-2 px-4 text-[13px] text-[#8e8e93]">
            <Lock className="h-4 w-4 shrink-0" strokeWidth={2} />
            {tr("Bu kun kassa yopilgan — xarajatni o'zgartirib bo'lmaydi")}
          </p>
        )}
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
      </>
    );
    footer = e.locked ? undefined : (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton
            danger
            onClick={() => {
              setError(null);
              setMode({ kind: "confirm", expense: e });
            }}
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
            {tr("O'chirish")}
          </SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <SheetPrimaryButton
            onClick={() => {
              fillForm(e);
              setMode({ kind: "form", editing: e });
            }}
          >
            <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
            {tr("Tahrirlash")}
          </SheetPrimaryButton>
        </div>
      </div>
    );
  } else {
    const e = mode.expense;
    title = tr("Xarajat o'chirilsinmi?");
    body = (
      <>
        <div className="rounded-[18px] px-4 py-3.5 text-[14px] leading-snug" style={{ backgroundColor: "rgba(255,59,48,0.10)", color: "#d70015" }}>
          <p className="font-semibold">
            {groupDigits(e.amount)} {tr("so'm")} · {tr(e.category)}
          </p>
          <p className="mt-1">{tr("Xarajat oylik hisobdan chiqib ketadi. Amallar jurnalida yozuv qoladi.")}</p>
        </div>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
      </>
    );
    footer = (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton onClick={back}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              setError(null);
              remove.mutate(e.id);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
          >
            {remove.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("O'chirish")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <IosSheet open={open} onClose={isRoot ? () => !busy && onClose() : back} title={title} cancelLabel={isRoot ? (mode.kind === "view" ? "Yopish" : "Bekor qilish") : "Orqaga"} footer={footer}>
        {body}
      </IosSheet>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
