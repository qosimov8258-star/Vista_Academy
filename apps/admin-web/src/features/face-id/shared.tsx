"use client";

import type { ReactNode } from "react";
import type { FaceEnrollmentStatus, FaceIdCommandStatus, FaceIdCommandType, FaceIdDeviceStatus } from "@/lib/types";
import { IOS } from "@/components/ios/tokens";
import { formatDateTime } from "@/lib/format";

/** Face ID bo'limining iOS uslubidagi umumiy qiymatlari — sahifalar va varaqlar uchun bitta joy. */

export const DEVICE_STATUS: Record<FaceIdDeviceStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Faol", color: IOS.green },
  INACTIVE: { label: "Nofaol", color: IOS.gray },
  MAINTENANCE: { label: "Texnik xizmatda", color: IOS.orange },
};

export const ENROLLMENT_STATUS: Record<FaceEnrollmentStatus, { label: string; color: string }> = {
  PENDING: { label: "Kutilmoqda", color: IOS.orange },
  REGISTERED: { label: "Ro'yxatga olindi", color: IOS.green },
  FAILED: { label: "Muvaffaqiyatsiz", color: IOS.red },
  REMOVED: { label: "Olib tashlangan", color: IOS.gray },
};

export const COMMAND_TYPE: Record<FaceIdCommandType, string> = {
  ADD_OR_UPDATE_USER: "Qo'shish",
  SET_FACE: "Yuzni yuklash",
  DELETE_USER: "O'chirish",
};

export const COMMAND_STATUS: Record<FaceIdCommandStatus, { label: string; color: string }> = {
  PENDING: { label: "Navbatda", color: IOS.gray },
  SENT: { label: "Agentda", color: IOS.orange },
  DONE: { label: "Bajarildi", color: IOS.green },
  FAILED: { label: "Xato", color: IOS.red },
};

/** Qurilma agenti shu vaqt ichida murojaat qilgan bo'lsa — onlayn (u har 5 soniyada so'raydi) */
export const DEVICE_ONLINE_MS = 2 * 60_000;
/** Obyekt agenti har daqiqada qurilmalar ro'yxatini so'raydi */
export const AGENT_ONLINE_MS = 3 * 60_000;

export function isOnline(lastSeenAt: string | null, windowMs: number): boolean {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < windowMs;
}

/** Aloqa holati: yashil nuqta «Onlayn», kulrang — oxirgi aloqa vaqti yoki «Hali ulanmagan» */
export function connectionText(lastSeenAt: string | null, windowMs: number): { online: boolean; text: string } {
  if (!lastSeenAt) return { online: false, text: "Hali ulanmagan" };
  if (isOnline(lastSeenAt, windowMs)) return { online: true, text: "Onlayn" };
  return { online: false, text: formatDateTime(lastSeenAt) };
}

/** Kichik rangli nuqta (aloqa holati) */
export function StatusDot({ online }: { online: boolean }) {
  return <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: online ? IOS.green : "#c7c7cc" }} />;
}

/** Varaq ichidagi rangli izoh bloki (ogohlantirish, muvaffaqiyat, xato) */
export function TintNote({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div role={color === IOS.red ? "alert" : "status"} className="rounded-[18px] px-4 py-3.5 text-[14px] leading-snug" style={{ backgroundColor: `${color}1a`, color: tintText(color) }}>
      {children}
    </div>
  );
}

/** Och fonda o'qiladigan matn rangi: to'q sariq/yashil tizim rangi oq fonda xira — to'qroq variant */
export function tintText(color: string): string {
  if (color === IOS.orange) return "#c93400";
  if (color === IOS.green) return "#248a3d";
  if (color === IOS.red) return "#d70015";
  return color;
}
