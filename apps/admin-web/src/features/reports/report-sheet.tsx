"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { FileSpreadsheet, FileText } from "lucide-react";
import { downloadCsv } from "@/lib/download";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { DayStepper, PeriodStepper, dayMonthLabel, shiftDay } from "@/components/ios/day-stepper";
import { Segmented } from "@/components/ios/form";
import { GROUP_BLOCK, SECTION_TITLE } from "@/components/ios/tokens";
import { todayTashkent } from "@/features/cash/shared";
import { useTr } from "@/i18n/tr";
import { periodLabel, shiftPeriod } from "@/features/payments/shared";

type Kind = "day" | "week" | "month" | "all";
type Format = "xlsx" | "pdf";

/** Haftaning dushanbasi (YYYY-MM-DD) */
function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDay(date, -((day + 6) % 7));
}

function lastDayOfMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Hisobotni yuklab olish varag'i (to'lovlar, xarajatlar): davr turi
 * (kunlik, haftalik, oylik, to'liq), davrning o'zi va fayl turi (Excel —
 * jadval va hisob-kitob uchun, PDF — chop etish va yuborish uchun). Fayl
 * serverda tuziladi: `GET {endpoint}?kind=&from=&to=&format=`.
 */
export function ReportSheet({
  open,
  onClose,
  period,
  title,
  endpoint,
  filePrefix,
  allHint,
  contents,
  formats = ["xlsx", "pdf"],
  params,
}: {
  open: boolean;
  onClose: () => void;
  /** Oylik tanlovning boshlang'ich oyi (sahifada ko'rilayotgan oy) */
  period?: string;
  title: string;
  endpoint: string;
  filePrefix: string;
  /** "To'liq" tanlanganda ko'rsatiladigan izoh (tarjima kaliti) */
  allHint: string;
  /** Hisobotda nima borligi haqida izoh (tarjima kaliti) */
  contents: string;
  /** Qaysi fayl turlari bor — bittasi bo'lsa tanlov ko'rsatilmaydi */
  formats?: Format[];
  /** So'rovga qo'shimcha parametrlar (masalan `branchId`) */
  params?: Record<string, string>;
}) {
  const tr = useTr();
  const [today, setToday] = useState("");
  const [kind, setKind] = useState<Kind>("month");
  const [day, setDay] = useState("");
  const [week, setWeek] = useState("");
  const [month, setMonth] = useState("");
  const [format, setFormat] = useState<Format>(formats[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Har ochilishda — bugun / shu hafta / sahifadagi oy
  useEffect(() => {
    if (!open) return;
    const t = todayTashkent();
    setToday(t);
    setDay(t);
    setWeek(mondayOf(t));
    setMonth(period ?? t.slice(0, 7));
    setError(null);
  }, [open, period]);

  const thisWeek = today ? mondayOf(today) : "";
  const ready = !!today && !!day && !!week && !!month;
  const range: { from?: string; to?: string; stamp: string } = !ready
    ? { stamp: "" }
    : kind === "day"
      ? { from: day, to: day, stamp: day }
      : kind === "week"
        ? { from: week, to: shiftDay(week, 6), stamp: `${week}_${shiftDay(week, 6)}` }
        : kind === "month"
          ? { from: `${month}-01`, to: lastDayOfMonth(month), stamp: month }
          : { stamp: "toliq" };

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ kind, format, ...(range.from ? { from: range.from, to: range.to! } : {}), ...params });
      await downloadCsv(`${endpoint}?${q}`, `${filePrefix}-${range.stamp}.${format}`);
      onClose();
    } catch {
      setError(tr("Hisobotni yuklab bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setBusy(false);
    }
  };

  const year = today ? Number(today.slice(0, 4)) : undefined;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr(title)}
      footer={
        <SheetPrimaryButton onClick={() => ready && download()} loading={busy} dim={!ready}>
          {tr("Yuklab olish")} · {format === "xlsx" ? "Excel" : "PDF"}
        </SheetPrimaryButton>
      }
    >
      <section>
        <h3 className={SECTION_TITLE}>{tr("Davr")}</h3>
        <div className={clsx(GROUP_BLOCK, "space-y-4 p-4")}>
          <Segmented<Kind>
            value={kind}
            onChange={setKind}
            label={tr("Davr")}
            options={[
              { value: "day", label: tr("Kunlik") },
              { value: "week", label: tr("Haftalik") },
              { value: "month", label: tr("Oylik") },
              { value: "all", label: tr("To'liq") },
            ]}
          />
          <div className="flex min-h-10 items-center justify-center">
            {kind === "day" && day && today && <DayStepper value={day} onChange={setDay} today={today} max={today} />}
            {kind === "week" && week && (
              <PeriodStepper
                onPrev={() => setWeek((w) => shiftDay(w, -7))}
                onNext={() => setWeek((w) => shiftDay(w, 7))}
                nextDisabled={week >= thisWeek}
                prevLabel={tr("Oldingi hafta")}
                nextLabel={tr("Keyingi hafta")}
                reset={week !== thisWeek ? { label: tr("Shu hafta"), onClick: () => setWeek(thisWeek) } : undefined}
              >
                {dayMonthLabel(week, tr, year)} — {dayMonthLabel(shiftDay(week, 6), tr, year)}
              </PeriodStepper>
            )}
            {kind === "month" && month && (
              <PeriodStepper
                onPrev={() => setMonth((m) => shiftPeriod(m, -1))}
                onNext={() => setMonth((m) => shiftPeriod(m, 1))}
                nextDisabled={!!today && month >= today.slice(0, 7)}
                prevLabel={tr("Oldingi oy")}
                nextLabel={tr("Keyingi oy")}
              >
                {periodLabel(month, tr)}
              </PeriodStepper>
            )}
            {kind === "all" && <p className="text-center text-[15px] text-[#8e8e93]">{tr(allHint)}</p>}
          </div>
        </div>
      </section>

      <section>
        {formats.length > 1 && <h3 className={SECTION_TITLE}>{tr("Fayl turi")}</h3>}
        <div role="radiogroup" aria-label={tr("Fayl turi")} className={clsx("grid grid-cols-2 gap-3", formats.length < 2 && "hidden")}>
          {(
            [
              { value: "xlsx", title: "Excel", hint: "Jadval: filtr va hisob-kitob uchun", icon: FileSpreadsheet, color: "#34c759" },
              { value: "pdf", title: "PDF", hint: "Chop etish va yuborish uchun", icon: FileText, color: "#ff3b30" },
            ] as const
          ).map((f) => {
            const active = format === f.value;
            const Icon = f.icon;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFormat(f.value)}
                className={clsx(
                  "flex flex-col items-start gap-2 rounded-[18px] bg-white p-4 text-left transition-transform active:scale-[0.98]",
                  active && "ring-2 ring-[var(--color-primary)]",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] text-white" style={{ backgroundColor: f.color }}>
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="text-[16px] font-semibold text-[var(--color-text)]">{f.title}</span>
                <span className="text-[12.5px] leading-snug text-[#8e8e93]">{tr(f.hint)}</span>
              </button>
            );
          })}
        </div>
        <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">
          {tr(contents)}
        </p>
        {error && <p className="px-4 pt-2 text-[13px] text-[#ff3b30]">{error}</p>}
      </section>
    </IosSheet>
  );
}
