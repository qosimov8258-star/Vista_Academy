"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Check, FileImage, FileText, Paperclip } from "lucide-react";
import { api } from "@/lib/api";
import type { StaffAbsenceDocument, StaffAttendanceHistory } from "@/lib/types";
import { PeriodStepper, dayMonthLabel, WEEKDAYS } from "@/components/ios/day-stepper";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { employeePhotoUrl } from "@/components/ui/employee-photo";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { CalendarIcon } from "@/components/ios/icons";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { periodLabel, shiftPeriod } from "@/features/payments/shared";
import { formatPositionLabel } from "@/lib/employee-position";
import { useTr } from "@/i18n/tr";
import { FaceIdMark, InOutTimes, isFaceIdRecord } from "./in-out-times";
import { IosIcon } from "@/features/director/ios-icon";
import { DOCUMENT_KIND_LABEL, DocumentChip, DocumentSheet, DocumentUploadSheet, datesLabel, useOpenDocument } from "./absence-documents";

/** Hujjat biriktiriladigan kunlar — xodim kelmagan kunlar (API bilan bir xil) */
const ABSENT_STATUSES = new Set(["ABSENT", "SICK", "ON_LEAVE"]);

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
 * kunlari kelgan/kelmagan). Kelmagan kunlarni belgilab, ular uchun bitta
 * hujjat (kasallik varaqasi, ariza) biriktiriladi — `preselect` bilan
 * oyna shu kun tanlangan holda ochiladi.
 */
export function EmployeeHistoryModal({
  open,
  onClose,
  slug,
  employeeId,
  branchId,
  period,
  onPeriodChange,
  canWrite = false,
  preselect = null,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employeeId: string | null;
  branchId: string;
  period: string;
  onPeriodChange: (period: string) => void;
  /** Hujjat yuklash va o'chirish (filial admini, administrator) */
  canWrite?: boolean;
  /** Ochilganda tanlash rejimi shu kun belgilangan holda yoqiladi */
  preselect?: string | null;
}) {
  const tr = useTr();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<StaffAbsenceDocument | null>(null);
  const { open: openDocument, error: openError } = useOpenDocument();
  useEffect(() => {
    if (!open) return;
    setSelecting(!!preselect && canWrite);
    setSelected(preselect && canWrite ? [preselect] : []);
  }, [open, preselect, canWrite, employeeId]);
  useEffect(() => {
    if (!preselect) setSelected([]);
  }, [period, preselect]);
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
  const absentDays = data ? data.days.filter((d) => ABSENT_STATUSES.has(d.status)) : [];
  const documentsOf = (date: string) => data?.documents.filter((doc) => doc.dates.includes(date)) ?? [];
  const toggle = (date: string) => setSelected((s) => (s.includes(date) ? s.filter((x) => x !== date) : [...s, date].sort()));

  return (
    <>
    <IosSheet
      open={open}
      onClose={onClose}
      title={tr("Xodim tarixi")}
      cancelLabel="Yopish"
      footer={
        selecting ? (
          <div className="space-y-2">
            <SheetPrimaryButton dim={!selected.length} onClick={() => selected.length && setUploadOpen(true)}>
              <Paperclip className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {selected.length ? tr("Hujjat yuklash · {0} kun", selected.length) : tr("Kelmagan kunlarni belgilang")}
            </SheetPrimaryButton>
            <button
              type="button"
              onClick={() => {
                setSelecting(false);
                setSelected([]);
              }}
              className="w-full py-1.5 text-[15px] text-[var(--color-primary)]"
            >
              {tr("Bekor qilish")}
            </button>
          </div>
        ) : undefined
      }
    >
      {!data && historyQuery.isLoading ? (
        <SkeletonRows rows={5} avatar={false} />
      ) : historyQuery.isError ? (
        <ErrorState message={(historyQuery.error as Error).message} onRetry={() => historyQuery.refetch()} retrying={historyQuery.isFetching} />
      ) : !data ? null : (
        <>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <IosAvatar name={data.employee.fullName} src={employeePhotoUrl(data.employee)} size={64} />
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
            <SheetSection
              title={
                canWrite && absentDays.length > 0 && !selecting ? (
                  <span className="flex items-center justify-between normal-case tracking-normal">
                    <span className="uppercase tracking-wide">{tr("Kunlar")}</span>
                    <button type="button" onClick={() => setSelecting(true)} className="inline-flex items-center gap-1 text-[14px] text-[var(--color-primary)]">
                      <Paperclip className="h-[14px] w-[14px]" strokeWidth={2.2} />
                      {tr("Hujjat biriktirish")}
                    </button>
                  </span>
                ) : selecting ? (
                  tr("Hujjat uchun kelmagan kunlarni belgilang")
                ) : undefined
              }
            >
              {data.days.map((day) => {
                const d = new Date(`${day.date}T00:00:00Z`);
                const selectable = selecting && ABSENT_STATUSES.has(day.status);
                const checked = selected.includes(day.date);
                const docs = documentsOf(day.date);
                return (
                  <div
                    key={day.date}
                    role={selectable ? "checkbox" : undefined}
                    aria-checked={selectable ? checked : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    onClick={selectable ? () => toggle(day.date) : undefined}
                    onKeyDown={selectable ? (e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), toggle(day.date)) : undefined}
                    className={clsx(
                      "group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2.5",
                      selectable && "cursor-pointer active:bg-black/[0.04]",
                      selecting && !selectable && "opacity-40",
                    )}
                  >
                    {selecting && (
                      <span
                        className={clsx(
                          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full",
                          checked ? "bg-[var(--color-primary)] text-white" : "ring-[1.5px] ring-inset ring-[#c7c7cc]",
                        )}
                        aria-hidden="true"
                      >
                        {checked && <Check className="h-[14px] w-[14px]" strokeWidth={3} />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-[var(--color-text)]">
                        {dayMonthLabel(day.date, tr)}
                        <span className="text-[#8e8e93]"> · {tr(WEEKDAYS[d.getUTCDay()])}</span>
                      </span>
                      {(day.checkInTime || day.checkOutTime) && (
                        <span className="mt-0.5 block">
                          <InOutTimes inline checkIn={day.checkInTime} checkOut={day.checkOutTime} late={day.status === "LATE"} />
                        </span>
                      )}
                      {day.note && (
                        <span className="block truncate text-[13px] text-[#8e8e93]">{isFaceIdRecord(day.note) ? <FaceIdMark /> : tr(day.note)}</span>
                      )}
                      {docs.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {docs.map((doc) => (
                            <DocumentChip key={doc.id} kind={doc.kind} onOpen={() => openDocument(doc.id)} />
                          ))}
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

          {data.documents.length > 0 && (
            <SheetSection title={tr("Hujjatlar")} footer={openError ?? undefined}>
              {data.documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setViewing(doc)}
                  className="group/row relative flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/[0.04]"
                >
                  <IosIcon icon={doc.mimeType === "application/pdf" ? FileText : FileImage} tint="blue" size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-[var(--color-text)]">
                      {tr(DOCUMENT_KIND_LABEL[doc.kind])} · {datesLabel(doc.dates)}
                    </span>
                    <span className="block truncate text-[13px] text-[#8e8e93]">
                      {doc.fileName} · {tr(doc.uploadedByName)}
                    </span>
                  </span>
                  <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
                </button>
              ))}
            </SheetSection>
          )}
        </>
      )}
    </IosSheet>

    {data && employeeId && (
      <DocumentUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        slug={slug}
        employeeId={employeeId}
        employeeName={data.employee.fullName}
        dates={selected}
        onUploaded={() => {
          setSelecting(false);
          setSelected([]);
        }}
      />
    )}
    <DocumentSheet document={viewing} onClose={() => setViewing(null)} slug={slug} canWrite={canWrite} />
    </>
  );
}
