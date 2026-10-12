"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ImagePlus, ReceiptText, RotateCcw, X } from "lucide-react";
import { api, ApiError, getPaginated } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { formatDateTime } from "@/lib/format";
import type { Invoice, PaymentMethod } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { PeriodStepper } from "@/components/ios/day-stepper";
import { SkeletonRows } from "@/components/ios/states";
import { Spinner } from "@/components/ios/spinner";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { Toast, type ToastState } from "@/components/ui/toast";
import { useAuthedImage } from "@/components/ui/child-photo";
import { currentMonth } from "@/features/cash/shared";
import { useTr } from "@/i18n/tr";
import {
  METHOD_COLOR,
  METHOD_LABEL,
  PAY_METHODS,
  groupDigits,
  periodLabel,
  prepareReceiptPhoto,
  shiftPeriod,
  type ChildPayment,
} from "./shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const OPEN_STATUSES = new Set(["PENDING", "PARTIALLY_PAID", "OVERDUE"]);
const CANCEL_REASONS = ["Xato kiritildi", "Pul qaytarildi", "Summa noto'g'ri", "Boshqa bolaga tegishli"];
const FILL = "bg-[#767680]/[0.12]";

interface AcceptResult {
  payment: { id: string };
  allocations: { period: string; amount: number; closed: boolean }[];
  advancePeriod: string | null;
  remainingDebt: number;
}

type Mode = { kind: "main" } | { kind: "detail"; payment: ChildPayment } | { kind: "cancel"; payment: ChildPayment };

export interface PaymentSheetChild {
  id: string;
  name: string;
}

/**
 * To'lov varag'i — bola bo'yicha to'lov qabul qilishning yagona joyi
 * (To'lovlar sahifasi, bola sahifasidagi kassa, hisob-fakturalar, qarzdorlar).
 *
 * Tepada qarz holati (oylar bo'yicha), o'rtada forma: summa — qarz bilan
 * to'ldirilgan, usul — 3×2 kapsulalar (sukut yo'q, tasodifan "naqd" bo'lib
 * ketmasin), naqddan boshqa usulda chek surati, izoh. Summa qarzni eng eski
 * oydan boshlab yopadi — qaysi oylar yopilishi oldindan ko'rinadi. Qarz yo'q
 * bo'lsa — tanlangan oy uchun oldindan to'lov. Pastki tugma nima
 * yetishmayotganini aytadi. So'nggi to'lovlar bosilsa — tafsilot, chek
 * surati, kvitansiya va sabab bilan bekor qilish (shu varaq ichida).
 */
export function PaymentSheet({
  slug,
  child,
  period,
  onClose,
}: {
  slug: string;
  child: PaymentSheetChild | null;
  /** Qarz yo'q bo'lganda oldindan to'lov oyi (sukut — joriy oy) */
  period?: string;
  onClose: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const open = child !== null;
  const [current, setCurrent] = useState<PaymentSheetChild | null>(child);
  useEffect(() => {
    if (child) setCurrent(child);
  }, [child]);
  const childId = current?.id ?? "";

  const [mode, setMode] = useState<Mode>({ kind: "main" });
  const [amount, setAmount] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [note, setNote] = useState("");
  const [advancePeriod, setAdvancePeriod] = useState(period ?? currentMonth());
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  // Har ochilishda forma toza holatdan boshlanadi
  useEffect(() => {
    if (!open) return;
    setMode({ kind: "main" });
    setAmount("");
    setPrefilled(false);
    setMethod(null);
    setPhoto(null);
    setNote("");
    setAdvancePeriod(period ?? currentMonth());
    setError(null);
    setShowMissing(false);
  }, [open, child?.id, period]);

  const invoicesQuery = useQuery({
    queryKey: ["pay-invoices", slug, childId],
    queryFn: () => getPaginated<Invoice>(`/app/invoices?childId=${childId}&limit=100`),
    enabled: open && !!childId,
  });
  const paymentsQuery = useQuery({
    queryKey: ["pay-history", slug, childId],
    queryFn: () => getPaginated<ChildPayment>(`/app/payments?childId=${childId}&limit=10`),
    enabled: open && !!childId,
  });

  const openInvoices = useMemo(
    () =>
      (invoicesQuery.data?.data ?? [])
        .filter((i) => OPEN_STATUSES.has(i.status))
        .map((i) => ({ ...i, remaining: Number(i.amount) - Number(i.discountAmount) - Number(i.paidAmount) }))
        .filter((i) => i.remaining > 0.005)
        .sort((a, b) => a.period.localeCompare(b.period)),
    [invoicesQuery.data],
  );
  const debt = Math.round(openInvoices.reduce((s, i) => s + i.remaining, 0));
  const loaded = invoicesQuery.isSuccess;

  // Summa — qolgan qarz bilan to'ldiriladi (bir marta, ma'lumot kelganda)
  useEffect(() => {
    if (!open || prefilled || !loaded) return;
    setAmount(debt > 0 ? String(debt) : "");
    setPrefilled(true);
  }, [open, prefilled, loaded, debt]);

  const value = Number(amount || 0);
  const tooBig = debt > 0 && value > debt;
  const needsPhoto = method !== null && method !== "CASH";

  // Summa qaysi oylarni yopadi — eng eski oydan boshlab
  const allocation = useMemo(() => {
    let left = value;
    const out: { period: string; part: number; full: boolean }[] = [];
    for (const inv of openInvoices) {
      if (left <= 0) break;
      const part = Math.min(left, Math.round(inv.remaining));
      left -= part;
      out.push({ period: inv.period, part, full: part >= Math.round(inv.remaining) });
    }
    return out;
  }, [value, openInvoices]);

  const missing = !loaded
    ? "Yuklanmoqda"
    : value <= 0
      ? "Summani kiriting"
      : tooBig
        ? "Summa qarzdan katta"
        : !method
          ? "Usulni tanlang"
          : needsPhoto && !photo
            ? "Chekni qo'shing"
            : null;

  const accept = useMutation({
    mutationFn: () =>
      api.post<AcceptResult>("/app/payments/accept", {
        childId,
        amount: value,
        method,
        period: debt > 0 ? undefined : advancePeriod,
        note: note.trim() || undefined,
        receiptImage: needsPhoto ? photo : undefined,
      }),
    onSuccess: (res) => {
      setToast({
        type: "success",
        message:
          res.remainingDebt > 0
            ? `${tr("Qisman to'lov qabul qilindi")} · ${tr("qoldi")} ${groupDigits(res.remainingDebt)} ${tr("so'm")}`
            : `${tr("To'lov qabul qilindi")} · ${groupDigits(value)} ${tr("so'm")}`,
      });
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const refund = useMutation({
    mutationFn: (paymentId: string) => api.post(`/app/payments/${paymentId}/refund`, { reason: reason.trim() }),
    onSuccess: async () => {
      setToast({ type: "success", message: tr("To'lov bekor qilindi") });
      setMode({ kind: "main" });
      setReason("");
      // Qarz yangilangach summa yangi qarz bilan qayta to'ldiriladi
      await queryClient.invalidateQueries();
      setPrefilled(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const busy = accept.isPending || refund.isPending;

  const submit = () => {
    if (missing) {
      setShowMissing(true);
      return;
    }
    setError(null);
    accept.mutate();
  };

  // Chek: fayl tanlash, sudrab tashlash yoki Ctrl+V
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
  useEffect(() => {
    if (!open || mode.kind !== "main" || !needsPhoto) return;
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

  const back = () => {
    if (busy) return;
    setError(null);
    if (mode.kind === "cancel") setMode({ kind: "detail", payment: mode.payment });
    else if (mode.kind === "detail") setMode({ kind: "main" });
    else onClose();
  };

  const payments = paymentsQuery.data?.data ?? [];

  let title: ReactNode = current?.name ?? "";
  let body: ReactNode;
  let footer: ReactNode;

  if (mode.kind === "main") {
    body = (
      <>
        {/* Qarz holati */}
        {!loaded ? (
          <div className={GROUP_BLOCK}>
            <SkeletonRows rows={2} avatar={false} />
          </div>
        ) : (
          <SheetSection title={tr("Holat")}>
            <div className="flex items-baseline justify-between gap-3 px-4 py-3.5">
              <span className="text-[15px] text-[var(--color-text)]">{debt > 0 ? tr("Jami qarz") : tr("Holat")}</span>
              {debt > 0 ? (
                <span className="text-[24px] font-bold tabular-nums" style={{ color: IOS.red }}>
                  {groupDigits(debt)} <span className="text-[15px] font-semibold">{tr("so'm")}</span>
                </span>
              ) : (
                <span className="text-[15px] font-semibold" style={{ color: IOS.green }}>
                  {tr("Qarz yo'q")} ✓
                </span>
              )}
            </div>
            {openInvoices.map((inv) => (
              <SheetRow key={inv.id} label={periodLabel(inv.period, tr)}>
                <span className="tabular-nums" style={inv.overdue ? { color: IOS.red } : undefined}>
                  {groupDigits(inv.remaining)} {tr("so'm")}
                </span>
                {Number(inv.paidAmount) > 0 && <span className="block text-[12px]">{tr("qisman to'langan")}</span>}
              </SheetRow>
            ))}
          </SheetSection>
        )}

        {/* Forma */}
        <section>
          <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">
            {loaded && debt === 0 ? tr("Oldindan to'lov") : tr("To'lovni qabul qilish")}
          </h3>
          <div className={clsx(GROUP_BLOCK, "space-y-4 p-4")}>
            {loaded && debt === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] text-[var(--color-text)]">{tr("Qaysi oy uchun")}</span>
                <PeriodStepper
                  onPrev={() => setAdvancePeriod((p) => shiftPeriod(p, -1))}
                  onNext={() => setAdvancePeriod((p) => shiftPeriod(p, 1))}
                  prevLabel={tr("Oldingi oy")}
                  nextLabel={tr("Keyingi oy")}
                >
                  {periodLabel(advancePeriod, tr)}
                </PeriodStepper>
              </div>
            )}

            {/* Summa */}
            <div>
              <div className="flex items-center gap-2">
                <label
                  className={clsx(
                    "flex h-14 min-w-0 flex-1 items-center gap-2 rounded-[14px] px-4",
                    FILL,
                    (tooBig || (showMissing && value <= 0)) && "ring-2 ring-[#ff3b30]",
                  )}
                >
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={tr("Summa")}
                    value={amount ? groupDigits(amount) : ""}
                    placeholder="0"
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12))}
                    className="min-w-0 flex-1 bg-transparent text-[24px] font-bold tabular-nums text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
                  />
                  <span className="shrink-0 text-[15px] font-semibold text-[#8e8e93]">{tr("so'm")}</span>
                </label>
                {debt > 0 && value !== debt && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(debt))}
                    className={clsx("h-14 shrink-0 rounded-[14px] px-4 text-[15px] font-semibold text-[var(--color-primary)] transition-transform active:scale-[0.96]", FILL)}
                  >
                    {tr("To'liq")}
                  </button>
                )}
              </div>
              <AmountHint debt={debt} value={value} allocation={allocation} advance={loaded && debt === 0 ? advancePeriod : null} />
            </div>

            {/* Usul */}
            <div>
              <p className={clsx("pb-2 text-[13px]", showMissing && !method ? "text-[#ff3b30]" : "text-[#8e8e93]")}>{tr("Pul qanday keldi?")}</p>
              <div role="radiogroup" aria-label={tr("To'lov usuli")} className="grid grid-cols-3 gap-2">
                {PAY_METHODS.map((m) => {
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
            </div>

            {/* Chek surati — naqddan boshqa usulda majburiy */}
            {needsPhoto && <ReceiptPicker photo={photo} busy={photoBusy} invalid={showMissing && !photo} onPick={takePhoto} onClear={() => setPhoto(null)} />}

            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder={tr("Izoh (ixtiyoriy)")}
              className={clsx("h-11 w-full rounded-[12px] px-3.5 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#8e8e93]", FILL)}
            />
          </div>
          {error && <p className="px-4 pt-2 text-[13px] text-[#ff3b30]">{error}</p>}
        </section>

        {/* So'nggi to'lovlar */}
        {payments.length > 0 && (
          <section>
            <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("So'nggi to'lovlar")}</h3>
            <div className={GROUP_BLOCK}>
              {payments.map((p) => (
                <Row
                  key={p.id}
                  onClick={() => {
                    setError(null);
                    setMode({ kind: "detail", payment: p });
                  }}
                  leading={<span className="ml-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: METHOD_COLOR[p.method] }} aria-hidden="true" />}
                  title={
                    <span className={clsx("tabular-nums", p.status === "REFUNDED" && "text-[#8e8e93] line-through")}>
                      {groupDigits(p.amount)} {tr("so'm")} · {tr(METHOD_LABEL[p.method])}
                    </span>
                  }
                  subtitle={[formatDateTime(p.createdAt), p.periods.map((x) => periodLabel(x.period, tr)).join(", ")].filter(Boolean).join(" · ")}
                  value={p.status === "REFUNDED" ? <Pill color={IOS.gray}>{tr("Bekor qilingan")}</Pill> : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </>
    );
    footer = (
      <SheetPrimaryButton onClick={submit} loading={accept.isPending} dim={!!missing}>
        {missing ? tr(missing) : `${tr("Qabul qilish")} · ${groupDigits(value)} ${tr("so'm")}`}
      </SheetPrimaryButton>
    );
  } else if (mode.kind === "detail") {
    const p = mode.payment;
    title = tr("To'lov");
    body = <PaymentDetail payment={p} />;
    footer = (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton
            onClick={() => {
              void downloadCsv(`/app/exports/payments/${p.id}/pdf`, `tolov-kvitansiyasi-${p.id}.pdf`).catch(() => setError(tr("Kvitansiyani yuklab bo'lmadi")));
            }}
          >
            <ReceiptText className="h-[18px] w-[18px]" strokeWidth={2} />
            {tr("Kvitansiya")}
          </SheetSecondaryButton>
        </div>
        {p.status === "COMPLETED" && (
          <div className="flex-1">
            <SheetSecondaryButton
              danger
              onClick={() => {
                setReason("");
                setError(null);
                setMode({ kind: "cancel", payment: p });
              }}
            >
              <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2} />
              {tr("Bekor qilish")}
            </SheetSecondaryButton>
          </div>
        )}
      </div>
    );
    if (error) body = <>{body}<p className="px-4 text-[13px] text-[#ff3b30]">{error}</p></>;
  } else {
    const p = mode.payment;
    const reasonOk = reason.trim().length >= 3;
    title = tr("To'lovni bekor qilish");
    body = (
      <>
        <div className="rounded-[18px] px-4 py-3.5 text-[14px] leading-snug" style={{ backgroundColor: "rgba(255,59,48,0.10)", color: "#d70015" }}>
          <p className="font-semibold">
            {groupDigits(p.amount)} {tr("so'm")} · {tr(METHOD_LABEL[p.method])}
          </p>
          <p className="mt-1">
            {p.periods.length > 0
              ? `${tr("Bekor qilingach shu oylar yana qarz bo'ladi")}: ${p.periods.map((x) => periodLabel(x.period, tr)).join(", ")}.`
              : tr("Bekor qilingach summa qarzga qaytadi.")}
          </p>
          <p className="mt-1">{tr("Yozuv o'chirilmaydi — sababi bilan amallar jurnalida qoladi.")}</p>
        </div>
        <section>
          <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("Sabab")}</h3>
          <div className={clsx(GROUP_BLOCK, "space-y-3 p-4")}>
            <div className="flex flex-wrap gap-2">
              {CANCEL_REASONS.map((r) => {
                const active = reason === tr(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(tr(r))}
                    className={clsx(
                      "h-9 rounded-full px-3.5 text-[14px] font-medium transition-transform active:scale-[0.96]",
                      active ? "bg-[#ff3b30] text-white" : clsx(FILL, "text-[var(--color-text)]"),
                    )}
                  >
                    {tr(r)}
                  </button>
                );
              })}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              rows={2}
              placeholder={tr("Sababni yozing")}
              className={clsx("w-full resize-none rounded-[12px] px-3.5 py-2.5 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#8e8e93]", FILL)}
            />
          </div>
          {error && <p className="px-4 pt-2 text-[13px] text-[#ff3b30]">{error}</p>}
        </section>
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
            disabled={!reasonOk || refund.isPending}
            onClick={() => {
              setError(null);
              refund.mutate(p.id);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
          >
            {refund.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("Bekor qilish")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <IosSheet open={open} onClose={mode.kind === "main" ? () => !busy && onClose() : back} title={title} cancelLabel={mode.kind === "main" ? "Yopish" : "Orqaga"} footer={footer}>
        {body}
      </IosSheet>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

function AmountHint({
  debt,
  value,
  allocation,
  advance,
}: {
  debt: number;
  value: number;
  allocation: { period: string; part: number; full: boolean }[];
  advance: string | null;
}) {
  const tr = useTr();
  let text: ReactNode = null;
  let color = "#8e8e93";
  if (advance) {
    text = `${tr("Qarz yo'q — to'lov oldindan yoziladi")}: ${periodLabel(advance, tr)}`;
  } else if (value > debt) {
    text = `${tr("Qolgan qarz")} ${groupDigits(debt)} ${tr("so'm")} — ${tr("undan ko'p qabul qilib bo'lmaydi")}`;
    color = "#ff3b30";
  } else if (value > 0 && allocation.length > 0) {
    const closes = allocation.map((a) => `${periodLabel(a.period, tr)}${a.full ? "" : ` (${tr("qisman")})`}`).join(", ");
    text = value < debt ? `${tr("Yopiladi")}: ${closes} · ${tr("qoldi")} ${groupDigits(debt - value)} ${tr("so'm")}` : `${tr("Yopiladi")}: ${closes}`;
    color = value < debt ? "#c93400" : "#248a3d";
  }
  if (!text) return null;
  return (
    <p className="px-1 pt-2 text-[13px] leading-snug" style={{ color }}>
      {text}
    </p>
  );
}

function ReceiptPicker({
  photo,
  busy,
  invalid,
  onPick,
  onClear,
}: {
  photo: string | null;
  busy: boolean;
  invalid: boolean;
  onPick: (file: File | null | undefined) => void;
  onClear: () => void;
}) {
  const tr = useTr();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  if (photo) {
    return (
      <div className={clsx("flex items-center gap-3 rounded-[14px] p-2 pr-3", FILL)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
        <img src={photo} alt={tr("Chek")} className="h-14 w-14 shrink-0 rounded-[10px] object-cover" />
        <span className="min-w-0 flex-1 text-[15px] text-[var(--color-text)]">{tr("Chek qo'shildi")}</span>
        <button
          type="button"
          onClick={onClear}
          aria-label={tr("Chekni olib tashlash")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.2] text-[#3c3c43] transition-transform active:scale-90"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onPick(e.dataTransfer.files?.[0]);
      }}
    >
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className={clsx(
          "flex w-full flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed px-4 py-4 text-center transition-colors",
          over ? "border-[#007aff] bg-[#007aff]/[0.06]" : invalid ? "border-[#ff3b30]/60" : "border-[#c7c7cc]",
        )}
      >
        {busy ? <Spinner className="h-6 w-6" /> : <ImagePlus className="h-6 w-6 text-[#007aff]" strokeWidth={2} />}
        <span className={clsx("text-[15px] font-medium", invalid ? "text-[#ff3b30]" : "text-[var(--color-text)]")}>{tr("Chek suratini qo'shing")}</span>
        <span className="text-[12.5px] text-[#8e8e93] max-sm:hidden">{tr("yoki shu yerga tashlang · Ctrl+V bilan qo'ying")}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PaymentDetail({ payment: p }: { payment: ChildPayment }) {
  const tr = useTr();
  const image = useAuthedImage(p.hasReceiptImage ? `${API_URL}/app/payments/${p.id}/receipt-image` : null);
  return (
    <>
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className={clsx("text-[32px] font-bold tabular-nums", p.status === "REFUNDED" ? "text-[#8e8e93] line-through" : "text-[var(--color-text)]")}>
          {groupDigits(p.amount)} <span className="text-[17px] font-semibold">{tr("so'm")}</span>
        </span>
        {p.status === "REFUNDED" ? <Pill color={IOS.gray}>{tr("Bekor qilingan")}</Pill> : <Pill color={IOS.green}>{tr("Qabul qilingan")}</Pill>}
      </div>
      <SheetSection>
        <SheetRow label={tr("Usul")}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_COLOR[p.method] }} aria-hidden="true" />
            {tr(METHOD_LABEL[p.method])}
          </span>
        </SheetRow>
        <SheetRow label={tr("Sana")}>{formatDateTime(p.createdAt)}</SheetRow>
        {p.periods.length > 0 && (
          <SheetRow label={tr("Oylar")}>
            {p.periods.map((x) => (
              <span key={x.invoiceId} className="block tabular-nums">
                {periodLabel(x.period, tr)} · {groupDigits(x.amount)}
              </span>
            ))}
          </SheetRow>
        )}
        {p.recordedByName && <SheetRow label={tr("Qabul qildi")}>{p.recordedByName}</SheetRow>}
        {p.note && <SheetRow label={tr("Izoh")}>{p.note}</SheetRow>}
        {p.refundedAt && <SheetRow label={tr("Bekor qilindi")}>{formatDateTime(p.refundedAt)}</SheetRow>}
      </SheetSection>
      {p.hasReceiptImage && (
        <SheetSection title={tr("Chek")}>
          {image.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL
            <img src={image.src} alt={tr("To'lov cheki")} className="max-h-[50vh] w-full object-contain" />
          ) : (
            <div className="flex h-40 items-center justify-center text-[13px] text-[#8e8e93]">{image.failed ? tr("Chekni yuklab bo'lmadi") : <Spinner className="h-6 w-6" />}</div>
          )}
        </SheetSection>
      )}
    </>
  );
}
