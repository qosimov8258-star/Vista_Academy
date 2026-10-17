"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StaffAttendanceHistory } from "@/lib/types";
import { PeriodStepper, dayMonthLabel, WEEKDAYS } from "@/components/ios/day-stepper";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { CalendarIcon } from "@/components/ios/icons";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { periodLabel, shiftPeriod } from "@/features/payments/shared";
import { formatPositionLabel } from "@/lib/employee-position";
import { useTr } from "@/i18n/tr";

export const STAFF_STATUS_LABEL = { PRESENT: "Keldi", ABSENT: "Kelmadi", LATE: "Kech qoldi", SICK: "Kasal", ON_LEAVE: "Ta'til" } as const;
export const STAFF_STATUS_COLOR = {
  PRESENT: IOS.green,
  ABSENT: IOS.red,
  LATE: IOS.orange,
  SICK: IOS.orange,
  ON_LEAVE: IOS.gray,
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
  const tr = useTr();
  const historyQuery = useQuery({
    queryKey: ["staff-attendance-history", slug, employeeId, branchId, period],
    queryFn: () =>
      api.get<StaffAttendanceHistory>(
        `/app/staff-attendance/history?employeeId=${employeeId}&branchId=${branchId}&period=${period}`,
      ),
    enabled: open && !!employeeId && !!branchId && !!period,
    placeholderData: (prev) => prev,
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
    <IosSheet open={open} onClose={onClose} title={tr("Xodim tarixi")} cancelLabel="Yopish">
      {!data && historyQuery.isLoading ? (
        <SkeletonRows rows={5} avatar={false} />
      ) : historyQuery.isError ? (
        <ErrorState message={(historyQuery.error as Error).message} onRetry={() => historyQuery.refetch()} retrying={historyQuery.isFetching} />
      ) : !data ? null : (
        <>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <IosAvatar name={data.employee.fullName} size={64} />
            <p className="mt-1 text-[17px] font-semibold text-[var(--color-text)]">{tr(data.employee.fullName)}</p>
            <p className="text-[13px] text-[#8e8e93]">
              {tr(formatPositionLabel(data.employee.position, data.employee.subjects))}
              {data.employee.groups.length > 0 ? ` · ${data.employee.groups.join(", ")}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <PeriodStepper
              onPrev={() => onPeriodChange(shiftPeriod(period, -1))}
              onNext={() => onPeriodChange(shiftPeriod(period, 1))}
              prevLabel={tr("Oldingi oy")}
              nextLabel={tr("Keyingi oy")}
            >
              {periodLabel(period, tr)}
            </PeriodStepper>
            <div className="flex gap-1.5">
              <Pill color={IOS.green}>
                {tr("Keldi:")} {present}
              </Pill>
              <Pill color={IOS.red}>
                {tr("Kelmadi:")} {missed}
              </Pill>
            </div>
          </div>

          {data.days.length === 0 ? (
            <EmptyState icon={CalendarIcon} title="Bu oy uchun davomat belgilanmagan" />
          ) : (
            <SheetSection>
              {data.days.map((day) => {
                const d = new Date(`${day.date}T00:00:00Z`);
                return (
                  <div key={day.date} className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-[var(--color-text)]">
                        {dayMonthLabel(day.date, tr)}
                        <span className="text-[#8e8e93]"> · {tr(WEEKDAYS[d.getUTCDay()])}</span>
                      </span>
                      {(day.checkInTime || day.checkOutTime || day.note) && (
                        <span className="block truncate text-[13px] tabular-nums text-[#8e8e93]">
                          {[day.checkInTime || day.checkOutTime ? `${day.checkInTime ?? "—"} – ${day.checkOutTime ?? "—"}` : null, day.note ? tr(day.note) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <Pill color={STAFF_STATUS_COLOR[day.status]}>{tr(STAFF_STATUS_LABEL[day.status])}</Pill>
                    <span className={ROW_SEPARATOR} aria-hidden="true" />
                  </div>
                );
              })}
            </SheetSection>
          )}
        </>
      )}
    </IosSheet>
  );
}
