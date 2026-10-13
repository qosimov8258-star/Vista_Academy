"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AttendanceStatus } from "@/lib/types";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { dayMonthLabel, WEEKDAYS } from "@/components/ios/day-stepper";
import { IOS } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Keldi",
  ABSENT: "Kelmadi",
  LATE: "Kech qoldi",
  SICK: "Kasal",
};

const MONTH_LABEL = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

const WEEKDAY_LABEL = ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Ya"];

type AttendanceRecord = { date: string; status: AttendanceStatus; note: string | null };

function isExcused(record: AttendanceRecord): boolean {
  return !!record.note && record.note.trim().length > 0;
}

/** Keldi / kech qoldi — yashil; sababli — to'q sariq; sababsiz — qizil */
function colorFor(record: AttendanceRecord): string {
  if (record.status === "PRESENT" || record.status === "LATE") return IOS.green;
  return isExcused(record) ? IOS.orange : IOS.red;
}

function buildMonthCells(year: number, month: number): ({ date: string; day: number } | null)[] {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // JS: Yak=0..Shan=6 — dushanbadan boshlanadigan kalendar uchun Dush=0..Yak=6 ga o'giramiz.
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day });
  }
  return cells;
}

/** Bitta kunning holati va izohi — bosilganda ochiladi. Tarbiyachi/administrator
 * shu yerdan ham izoh yoza oladi, kunlik davomat sahifasiga qaytmasdan. */
function AttendanceDaySheet({
  open,
  onClose,
  slug,
  childId,
  record,
  canEditNote,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  record: AttendanceRecord;
  canEditNote: boolean;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(record.note ?? "");
  const canEdit = canEditNote && record.status !== "PRESENT";

  const mutation = useMutation({
    mutationFn: () => api.post("/app/attendance", { childId, date: record.date, status: record.status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-attendance-history", slug, childId] });
      onClose();
    },
  });

  const color = colorFor(record);
  const weekday = WEEKDAYS[new Date(`${record.date}T00:00:00Z`).getUTCDay()];
  const title = `${tr(weekday)}, ${dayMonthLabel(record.date, tr, new Date().getFullYear())}`;

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={title}
      cancelLabel="Yopish"
      footer={
        canEdit ? (
          <SheetPrimaryButton loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {tr("Saqlash")}
          </SheetPrimaryButton>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-[16px] text-[22px] font-bold tabular-nums"
          style={{ color, backgroundColor: `${color}24` }}
        >
          {Number(record.date.slice(8, 10))}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Pill color={color}>{tr(STATUS_LABEL[record.status])}</Pill>
          {record.status !== "PRESENT" && record.status !== "LATE" && (
            <Pill color={color}>{isExcused(record) ? tr("Sababli") : tr("Sababsiz")}</Pill>
          )}
        </div>
      </div>

      {canEdit ? (
        <SheetSection title={tr("Izoh")} footer={tr("Izoh yozilsa, kun «Sababli» deb hisoblanadi")}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={tr("Masalan: harorati baland edi, shifokorga bordik...")}
            aria-label={tr("Izoh")}
            className="block w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
          />
        </SheetSection>
      ) : record.note ? (
        <SheetSection title={tr("Izoh")}>
          <p className="whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-snug text-[var(--color-text)]">{tr(record.note)}</p>
        </SheetSection>
      ) : record.status !== "PRESENT" ? (
        <p className="px-4 text-center text-[13px] text-[#8e8e93]">{tr("Izoh yozilmagan")}</p>
      ) : null}

      {mutation.isError && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {mutation.error instanceof ApiError ? mutation.error.message : tr("Saqlab bo'lmadi — qayta urinib ko'ring")}
        </p>
      )}
    </IosSheet>
  );
}

const ARROW =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text)] transition-[transform,opacity] active:scale-[0.92] disabled:pointer-events-none disabled:opacity-30";

/** Bola kabinetidagi Davomat kartasiga qo'shiladigan oylik kalendar — har bir
 * kun holatiga qarab rangga bo'yaladi, bosilganda tafsilot (va kerak bo'lsa
 * izoh yozish) varag'i ochiladi. */
export function ChildAttendanceCalendar({
  slug,
  childId,
  year,
  records,
  canEditNote,
}: {
  slug: string;
  childId: string;
  year: number;
  records: AttendanceRecord[];
  canEditNote: boolean;
}) {
  const tr = useTr();
  const currentDate = new Date();
  const isCurrentYear = year === currentDate.getFullYear();
  const defaultMonth = isCurrentYear
    ? currentDate.getMonth()
    : records.length > 0
      ? Number(records[records.length - 1].date.slice(5, 7)) - 1
      : 0;
  const [month, setMonth] = useState(defaultMonth);
  // Varaq yopilish animatsiyasida ham kun ko'rinib tursin — sana tozalanmaydi, faqat `open` o'chadi
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Har ochilishda varaq yangidan yaratiladi — saqlanmagan izoh qolib ketmasin
  const [openCount, setOpenCount] = useState(0);

  const recordByDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const selectedRecord = selectedDate ? recordByDate.get(selectedDate) : undefined;
  const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  const counts = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const result = { present: 0, excused: 0, absent: 0 };
    for (const r of records) {
      if (!r.date.startsWith(prefix)) continue;
      const color = colorFor(r);
      if (color === IOS.green) result.present += 1;
      else if (color === IOS.orange) result.excused += 1;
      else result.absent += 1;
    }
    return result;
  }, [records, year, month]);

  return (
    <div className="space-y-4 rounded-[18px] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex h-11 items-center rounded-full bg-[#767680]/[0.12] px-0.5">
          <button type="button" className={ARROW} disabled={month === 0} onClick={() => setMonth((m) => Math.max(0, m - 1))} aria-label={tr("Oldingi oy")}>
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <span className="min-w-[112px] px-1 text-center text-[15px] font-medium tabular-nums text-[var(--color-text)]">
            {tr(MONTH_LABEL[month])} {year}
          </span>
          <button type="button" className={ARROW} disabled={month === 11} onClick={() => setMonth((m) => Math.min(11, m + 1))} aria-label={tr("Keyingi oy")}>
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
        {isCurrentYear && month !== currentDate.getMonth() && (
          <button
            type="button"
            onClick={() => setMonth(currentDate.getMonth())}
            className="h-11 rounded-full bg-[#767680]/[0.12] px-4 text-[15px] font-medium text-[var(--color-primary)] transition-transform active:scale-[0.96]"
          >
            {tr("Shu oy")}
          </button>
        )}
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 pb-1.5 text-center text-[12.5px] text-[#8e8e93]">
          {WEEKDAY_LABEL.map((d) => (
            <div key={d}>{tr(d)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />;
            const record = recordByDate.get(cell.date);
            const color = record ? colorFor(record) : null;
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!record}
                onClick={() => {
                  if (!record) return;
                  setSelectedDate(cell.date);
                  setOpenCount((n) => n + 1);
                  setSheetOpen(true);
                }}
                aria-label={record ? `${cell.day} — ${tr(STATUS_LABEL[record.status])}` : undefined}
                className={clsx(
                  "flex h-11 min-w-0 items-center justify-center rounded-[12px] text-[15px] tabular-nums transition-[transform,filter] disabled:cursor-default",
                  record ? "font-semibold active:scale-[0.92] hover:brightness-95" : "text-[#8e8e93]",
                  isToday && "ring-2 ring-inset ring-[var(--color-primary)]",
                )}
                style={color ? { color, backgroundColor: `${color}24` } : undefined}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-[#8e8e93]">
        <Legend color={IOS.green} label={tr("Keldi")} count={counts.present} />
        <Legend color={IOS.orange} label={tr("Sababli kelmadi")} count={counts.excused} />
        <Legend color={IOS.red} label={tr("Sababsiz kelmadi")} count={counts.absent} />
        <Legend color={IOS.gray} label={tr("Belgilanmagan")} />
      </div>

      {selectedRecord && (
        <AttendanceDaySheet
          key={`${selectedRecord.date}-${openCount}`}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          slug={slug}
          childId={childId}
          record={selectedRecord}
          canEditNote={canEditNote}
        />
      )}
    </div>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: count === undefined ? 0.45 : 1 }} />
      {label}
      {count !== undefined && <span className="font-semibold tabular-nums text-[var(--color-text)]">{count}</span>}
    </span>
  );
}
