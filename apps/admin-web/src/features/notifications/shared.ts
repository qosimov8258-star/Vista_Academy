import { CalendarClock, MessageSquare, NotebookPen, Phone, ShieldAlert, Syringe, UserX, Wallet } from "lucide-react";
import type { NotificationChannel, NotificationEventType } from "@/lib/types";
import type { AnyIcon, IosTint } from "@/features/director/ios-icon";

/** Hodisa turi: nomi, plitka belgisi va rangi */
export const EVENT_META: Record<NotificationEventType, { label: string; icon: AnyIcon; tint: IosTint }> = {
  CHILD_ABSENT: { label: "Bola kelmadi", icon: UserX, tint: "red" },
  DAILY_REPORT_READY: { label: "Kundalik hisobot tayyor", icon: NotebookPen, tint: "blue" },
  PAYMENT_DUE: { label: "To'lov muddati", icon: CalendarClock, tint: "orange" },
  PAYMENT_OVERDUE: { label: "To'lov kechikdi", icon: Wallet, tint: "red" },
  VACCINATION_DUE: { label: "Vaksinatsiya muddati", icon: Syringe, tint: "teal" },
  QUARANTINE_ALERT: { label: "Karantin xabari", icon: ShieldAlert, tint: "purple" },
  LEAD_FOLLOW_UP: { label: "Ariza bo'yicha aloqa", icon: Phone, tint: "indigo" },
  CUSTOM: { label: "Boshqa", icon: MessageSquare, tint: "gray" },
};

/** Qo'lda yozuv yaratishda tanlanadigan hodisalar */
export const CREATABLE_EVENTS: NotificationEventType[] = ["CUSTOM", "CHILD_ABSENT", "DAILY_REPORT_READY", "PAYMENT_DUE"];

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  PHONE_CALL: "Telefon qo'ng'iroq",
  SMS: "SMS",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
  IN_APP: "Ilova ichida",
};

export const CHANNEL_ORDER: NotificationChannel[] = ["PHONE_CALL", "SMS", "TELEGRAM", "EMAIL", "IN_APP"];


export const TEXTAREA =
  "block w-full resize-none bg-transparent py-1 text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";
export const DANGER_BOX = "rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]";
export const SUCCESS_BOX = "rounded-[14px] bg-[#34c759]/[0.12] px-4 py-2.5 text-[13px] leading-snug text-[#248a3d]";
