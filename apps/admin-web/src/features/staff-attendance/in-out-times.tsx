"use client";

import clsx from "clsx";
import { LogIn, LogOut, ScanFace } from "lucide-react";
import { IOS } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

/** Terminal yaratgan davomat yozuvi izohi — agent shu bilan belgilaydi (API: face-id-agent.service). */
export const FACE_ID_NOTE = "Face ID";

export const isFaceIdRecord = (note: string | null | undefined) => note === FACE_ID_NOTE;

/**
 * Kirish (yashil, →) va chiqish (ko'k, ←) vaqti — ikki qator, o'ngga
 * tekislangan. Vaqt bo'lmasa kulrang chiziqcha; `late` bo'lsa kirish
 * to'q sariq. `inline` — bitta qatorda (tarix oynasidagi kun qatori uchun).
 */
export function InOutTimes({
  checkIn,
  checkOut,
  late = false,
  inline = false,
}: {
  checkIn: string | null;
  checkOut: string | null;
  late?: boolean;
  inline?: boolean;
}) {
  const tr = useTr();
  return (
    <span className={clsx("flex tabular-nums", inline ? "items-center gap-3" : "flex-col items-end gap-0.5")}>
      <TimeMark icon={LogIn} label={tr("Kirish")} time={checkIn} color={late ? IOS.orange : IOS.green} />
      <TimeMark icon={LogOut} label={tr("Chiqish")} time={checkOut} color={IOS.blue} />
    </span>
  );
}

function TimeMark({ icon: Icon, label, time, color }: { icon: typeof LogIn; label: string; time: string | null; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label} aria-label={`${label}: ${time ?? "—"}`}>
      <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={2.2} style={{ color: time ? color : "#c7c7cc" }} aria-hidden="true" />
      <span className={clsx("w-[38px] text-[14px] font-semibold leading-5", time ? "text-[var(--color-text)]" : "text-[#c7c7cc]")}>{time ?? "—"}</span>
    </span>
  );
}

/** Kichik «Face ID» belgisi — vaqtni terminal yozganini bildiradi */
export function FaceIdMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[#30b0c7]">
      <ScanFace className="h-[13px] w-[13px]" strokeWidth={2.2} aria-hidden="true" />
      Face ID
    </span>
  );
}
