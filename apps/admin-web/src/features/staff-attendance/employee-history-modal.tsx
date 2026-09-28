"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StaffAttendanceHistory } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatPositionLabel } from "@/lib/employee-position";
import { formatDate } from "@/lib/format";
import { initials } from "@/components/ui/avatar";

const STATUS_LABEL = { PRESENT: "Keldi", ABSENT: "Kelmadi", LATE: "Kech qoldi", SICK: "Kasal", ON_LEAVE: "Ta'til" } as const;
const STATUS_TONE = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  SICK: "warning",
  ON_LEAVE: "neutral",
} as const;

/**
 * "Xodimlar ro'yxati" qatoriga bosilganda ochiladi — hisob kabineti emas,
 * faqat o'sha xodimning bir oylik davomat tarixi (kim, qaysi kasb, qaysi
 * kunlari kelgan/kelmagan).
 */
export function EmployeeHistoryModal({
  open,
  onClose,
  slug,
  employeeId,
  branchId,
  period,
  onPeriodChange,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employeeId: string | null;
  branchId: string;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const historyQuery = useQuery({
    queryKey: ["staff-attendance-history", slug, employeeId, branchId, period],
    queryFn: () =>
      api.get<StaffAttendanceHistory>(
        `/app/staff-attendance/history?employeeId=${employeeId}&branchId=${branchId}&period=${period}`,
      ),
    enabled: open && !!employeeId && !!branchId && !!period,
  });

  const data = historyQuery.data;
  const counts = data
    ? data.days.reduce(
        (acc, d) => {
          acc[d.status] = (acc[d.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : {};
  const present = counts.PRESENT ?? 0;
  const missed = (counts.ABSENT ?? 0) + (counts.LATE ?? 0) + (counts.SICK ?? 0) + (counts.ON_LEAVE ?? 0);

  return (
    <Modal open={open} onClose={onClose} title="Xodim tarixi" widthClassName="max-w-lg">
      {!data && historyQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : historyQuery.isError ? (
        <ErrorState message={(historyQuery.error as Error).message} />
      ) : !data ? null : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[16px] font-semibold text-[var(--color-primary)] ring-1 ring-inset ring-[rgba(16,24,40,0.06)]">
              {initials(data.employee.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold text-[var(--color-text)]">{data.employee.fullName}</p>
              <p className="text-[13px] text-[var(--color-text-muted)]">
                {formatPositionLabel(data.employee.position, data.employee.subjects)}
                {data.employee.groups.length > 0 ? ` · ${data.employee.groups.join(", ")}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Badge tone="success">Keldi: {present}</Badge>
              <Badge tone="danger">Kelmadi: {missed}</Badge>
            </div>
            <input
              type="month"
              value={period}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {data.days.length === 0 ? (
            <EmptyState title="Bu oy uchun davomat belgilanmagan" />
          ) : (
            <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto scrollbar-thin">
              {data.days.map((day) => (
                <li
                  key={day.date}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-[var(--color-text)]">{formatDate(day.date)}</p>
                    {(day.checkInTime || day.checkOutTime) && (
                      <p className="text-[12px] text-[var(--color-text-muted)]">
                        {day.checkInTime ?? "—"} – {day.checkOutTime ?? "—"}
                      </p>
                    )}
                    {day.note && <p className="text-[12px] text-[var(--color-text-muted)]">{day.note}</p>}
                  </div>
                  <Badge tone={STATUS_TONE[day.status]}>{STATUS_LABEL[day.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
