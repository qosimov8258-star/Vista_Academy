"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { LogIn, LogOut, X } from "lucide-react";
import type { StaffAttendanceStatus } from "@/lib/types";
import { IosAvatar } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";
import { STAFF_STATUS_COLOR, STAFF_STATUS_LABEL } from "./employee-history-modal";
import { FaceIdMark } from "./in-out-times";

export interface DayDraft {
  status: StaffAttendanceStatus | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

export const isPresentStatus = (status: StaffAttendanceStatus | null) => status === "PRESENT" || status === "LATE";

// Qo'lda «Keldi» qilinganda bo'sh vaqtlar shu bilan to'ldiriladi — ko'pchilik
// xodim har kuni shu oraliqda ishlaydi, faqat istisnolar o'zgartiriladi.
export const DEFAULT_CHECK_IN_TIME = "07:30";
export const DEFAULT_CHECK_OUT_TIME = "18:00";

const STATUS_ORDER: StaffAttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "SICK", "ON_LEAVE"];

/**
 * Bir xodimning bir kunlik davomati: holat va kirish/chiqish vaqti.
 * Saqlamaydi — «Tayyor» qoralamani sahifaga qaytaradi, sahifadagi
 * «Saqlash» hammasini birdan yozib kunni qulflaydi. `editable` bo'lmasa
 * faqat ko'rsatadi.
 */
export function DayEditSheet({
  open,
  onClose,
  employee,
  value,
  editable,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  employee: { fullName: string; position: string; faceId: boolean; recorded: DayDraft } | null;
  value: DayDraft;
  editable: boolean;
  onApply: (draft: DayDraft) => void;
}) {
  const tr = useTr();
  const [draft, setDraft] = useState<DayDraft>(value);
  // Har ochilishda sahifadagi joriy qiymatdan boshlanadi
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const present = isPresentStatus(draft.status);
  const pickStatus = (status: StaffAttendanceStatus) =>
    setDraft((d) =>
      isPresentStatus(status) && !d.checkInTime
        ? { status, checkInTime: DEFAULT_CHECK_IN_TIME, checkOutTime: d.checkOutTime ?? DEFAULT_CHECK_OUT_TIME }
        : { ...d, status },
    );
  const recorded = employee?.recorded;
  const terminalChanged =
    employee?.faceId && recorded && (draft.checkInTime !== recorded.checkInTime || draft.checkOutTime !== recorded.checkOutTime);

  return (
    <IosSheet
      open={open}
      onClose={onClose}
      cancelLabel={editable ? "Bekor" : "Yopish"}
      title={employee ? tr(employee.fullName) : ""}
      footer={
        editable ? (
          <SheetPrimaryButton
            dim={!draft.status}
            onClick={() => {
              if (!draft.status) return;
              onApply(present ? draft : { ...draft, checkInTime: null, checkOutTime: null });
              onClose();
            }}
          >
            {tr("Tayyor")}
          </SheetPrimaryButton>
        ) : undefined
      }
    >
      {employee && (
        <>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <IosAvatar name={employee.fullName} size={56} />
            <span className="text-[13px] text-[#8e8e93]">
              {tr(employee.position)}
              {employee.faceId && (
                <>
                  {" · "}
                  <FaceIdMark />
                </>
              )}
            </span>
          </div>

          <SheetSection title={tr("Holat")}>
            {/* 5 ta variant — kapsula radio to'ri (native select emas) */}
            <div role="radiogroup" aria-label={tr("Holat")} className="flex flex-wrap gap-2 p-3">
              {STATUS_ORDER.map((status) => {
                const selected = draft.status === status;
                const color = STAFF_STATUS_COLOR[status];
                return (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!editable}
                    onClick={() => pickStatus(status)}
                    className={clsx(
                      "h-10 rounded-full px-4 text-[15px] font-medium transition-[transform,background-color] active:scale-[0.96] disabled:active:scale-100",
                      !selected && "bg-[#767680]/[0.12] text-[var(--color-text)]",
                    )}
                    style={selected ? { backgroundColor: `${color}26`, color } : undefined}
                  >
                    {tr(STAFF_STATUS_LABEL[status])}
                  </button>
                );
              })}
            </div>
          </SheetSection>

          {present && (
            <SheetSection
              title={tr("Vaqt")}
              footer={
                terminalChanged
                  ? tr("Terminal yozgan vaqt: kirish {0}, chiqish {1}", recorded?.checkInTime ?? "—", recorded?.checkOutTime ?? "—")
                  : editable
                    ? tr("Chiqish bo'sh bo'lsa — hali ketmagan.")
                    : undefined
              }
            >
              <TimeRow
                icon={LogIn}
                color={draft.status === "LATE" ? IOS.orange : IOS.green}
                label={tr("Kirish")}
                value={draft.checkInTime}
                editable={editable}
                onChange={(v) => setDraft((d) => ({ ...d, checkInTime: v }))}
              />
              <TimeRow
                icon={LogOut}
                color={IOS.blue}
                label={tr("Chiqish")}
                value={draft.checkOutTime}
                editable={editable}
                onChange={(v) => setDraft((d) => ({ ...d, checkOutTime: v }))}
              />
            </SheetSection>
          )}
        </>
      )}
    </IosSheet>
  );
}

function TimeRow({
  icon: Icon,
  color,
  label,
  value,
  editable,
  onChange,
}: {
  icon: typeof LogIn;
  color: string;
  label: string;
  value: string | null;
  editable: boolean;
  onChange: (value: string | null) => void;
}) {
  const tr = useTr();
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px]" style={{ backgroundColor: color }}>
        <Icon className="h-[15px] w-[15px] text-white" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="flex-1 text-[16px] text-[var(--color-text)]">{label}</span>
      {editable ? (
        <span className="flex items-center gap-1">
          <input
            type="time"
            aria-label={label}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
            className="h-9 rounded-[10px] bg-[#767680]/[0.12] px-2.5 text-[17px] font-semibold tabular-nums text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={tr("{0} vaqtini tozalash", label)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#8e8e93] active:bg-[#767680]/[0.12]"
            >
              <X className="h-[16px] w-[16px]" strokeWidth={2.2} />
            </button>
          )}
        </span>
      ) : (
        <span className="text-[17px] font-semibold tabular-nums" style={{ color: value ? "var(--color-text)" : "#c7c7cc" }}>
          {value ?? "—"}
        </span>
      )}
      <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
    </div>
  );
}
