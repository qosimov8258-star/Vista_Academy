"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { AttendanceStatus } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";

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

function toneFor(record: AttendanceRecord): "success" | "warning" | "danger" {
  if (record.status === "PRESENT" || record.status === "LATE") return "success";
  return isExcused(record) ? "warning" : "danger";
}

function dayCellClass(record: AttendanceRecord | undefined): string {
  if (!record) return "text-[var(--color-text-muted)]";
  const tone = toneFor(record);
  const map: Record<string, string> = {
    success: "cursor-pointer bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25",
    warning: "cursor-pointer bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25",
    danger: "cursor-pointer bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25",
  };
  return map[tone];
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
function AttendanceDayModal({
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

  return (
    <Modal open={open} onClose={onClose} title={formatDate(record.date)} widthClassName="max-w-sm">
      <div className="space-y-4">
        <Badge tone={toneFor(record)}>{STATUS_LABEL[record.status]}</Badge>

        {canEdit ? (
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text)]">Izoh</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Masalan: harorati baland edi, shifokorga bordik..."
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3 py-2 text-[14px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
        ) : record.note ? (
          <p className="text-[14px] text-[var(--color-text-muted)]">{record.note}</p>
        ) : record.status !== "PRESENT" ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Izoh yozilmagan</p>
        ) : null}

        {mutation.isError && (
          <p className="text-[13px] text-[var(--color-danger)]">
            {mutation.error instanceof ApiError ? mutation.error.message : "Saqlab bo'lmadi — qayta urinib ko'ring"}
          </p>
        )}

        {canEdit && (
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Saqlash
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Bola kabinetidagi Davomat kartasiga qo'shiladigan oylik kalendar — har bir
 * kun holatiga qarab rangga bo'yaladi, bosilganda tafsilot (va kerak bo'lsa
 * izoh yozish) oynasi ochiladi. */
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
  const currentDate = new Date();
  const defaultMonth =
    year === currentDate.getFullYear()
      ? currentDate.getMonth()
      : records.length > 0
        ? Number(records[records.length - 1].date.slice(5, 7)) - 1
        : 0;
  const [month, setMonth] = useState(defaultMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const recordByDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const selectedRecord = selectedDate ? recordByDate.get(selectedDate) : undefined;

  return (
    <div className="space-y-3 border-t border-[var(--color-separator)] px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={month === 0}
          onClick={() => setMonth((m) => Math.max(0, m - 1))}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)] disabled:pointer-events-none disabled:opacity-30"
          aria-label="Oldingi oy"
        >
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
        </button>
        <p className="text-[14px] font-medium text-[var(--color-text)]">
          {MONTH_LABEL[month]} {year}
        </p>
        <button
          type="button"
          disabled={month === 11}
          onClick={() => setMonth((m) => Math.min(11, m + 1))}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)] disabled:pointer-events-none disabled:opacity-30"
          aria-label="Keyingi oy"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[var(--color-text-muted)]">
        {WEEKDAY_LABEL.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const record = recordByDate.get(cell.date);
          return (
            <button
              key={cell.date}
              type="button"
              disabled={!record}
              onClick={() => record && setSelectedDate(cell.date)}
              className={clsx(
                "flex h-9 items-center justify-center rounded-[var(--radius-md)] text-[13px] font-medium tabular-nums transition-colors disabled:cursor-default",
                dayCellClass(record),
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[12px] text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-success)]" /> Keldi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]" /> Sababli kelmadi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]" /> Sababsiz kelmadi
        </span>
      </div>

      {selectedRecord && (
        <AttendanceDayModal
          open
          onClose={() => setSelectedDate(null)}
          slug={slug}
          childId={childId}
          record={selectedRecord}
          canEditNote={canEditNote}
        />
      )}
    </div>
  );
}
