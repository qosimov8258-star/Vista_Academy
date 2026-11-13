"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import {
  BellRing,
  CalendarDays,
  FileText,
  Home,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  NotebookPen,
  Settings,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { IOS } from "@/components/ios/tokens";
import type { IosTint } from "@/features/director/ios-icon";
import type { EngagementLevel, GuardianRelation } from "./types";

/** Kabinet bo'limlari — nomi, ikonkasi, rangi (API `page` kalitlari bilan bir xil) */
export const PAGE_META: Record<string, { label: string; icon: LucideIcon; tint: IosTint; hint: string }> = {
  home: { label: "Bosh sahifa", icon: Home, tint: "blue", hint: "Bolaning bugungi kuni" },
  kundalik: { label: "Kundalik", icon: NotebookPen, tint: "orange", hint: "Ovqat, kun tartibi, natijalar" },
  jadval: { label: "Jadval", icon: CalendarDays, tint: "teal", hint: "Haftalik kun tartibi" },
  fayllar: { label: "Fayllar", icon: FileText, tint: "indigo", hint: "Guruh rasmlari va hujjatlar" },
  tolov: { label: "To'lov", icon: Wallet, tint: "green", hint: "To'lov holati va chek" },
  dokon: { label: "Do'kon", icon: Store, tint: "pink", hint: "Yulduzcha sovg'alari" },
  foydali: { label: "Foydali", icon: Lightbulb, tint: "orange", hint: "She'r, maqol, ertak" },
  xabarlar: { label: "Xabarlar", icon: MessageSquareText, tint: "purple", hint: "Bog'cha xabarlari" },
  sozlamalar: { label: "Sozlamalar", icon: Settings, tint: "gray", hint: "Parol, ko'rinish" },
  tanlash: { label: "Farzand tanlash", icon: ListChecks, tint: "gray", hint: "Bir nechta farzand" },
};

export const PUSH_ICON = BellRing;

export const LEVEL_META: Record<EngagementLevel, { label: string; color: string; hint: string }> = {
  ACTIVE: { label: "Faol", color: IOS.green, hint: "Oxirgi 3 kunda kirgan" },
  LOW: { label: "Kam faol", color: IOS.orange, hint: "3–14 kun oldin kirgan" },
  INACTIVE: { label: "Nofaol", color: IOS.red, hint: "14 kundan beri kirmagan" },
  UNCONNECTED: { label: "Kabinet ochilmagan", color: IOS.gray, hint: "Parol berilmagan" },
};

export const RELATION_LABEL: Record<GuardianRelation, string> = {
  MOTHER: "Onasi",
  FATHER: "Otasi",
  GRANDPARENT: "Buvi/bobo",
  OTHER: "Vasiy",
};

type Tr = (key: string, ...args: (string | number)[]) => string;

/** Soniya → «1 soat 5 daq», «12 daq», «<1 daq», «0» */
export function formatDuration(seconds: number, tr: Tr): string {
  if (seconds <= 0) return "0";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return tr("<1 daq");
  if (minutes < 60) return tr("{0} daq", minutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? tr("{0} soat {1} daq", h, m) : tr("{0} soat", h);
}

/** «hozir», «5 daq oldin», «3 soat oldin», «kecha», «4 kun oldin», «12.10» */
export function formatAgo(iso: string | null, tr: Tr): string {
  if (!iso) return tr("hech qachon");
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return tr("hozir");
  if (min < 60) return tr("{0} daq oldin", min);
  const hours = Math.floor(min / 60);
  if (hours < 24) return tr("{0} soat oldin", hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return tr("kecha");
  if (days < 30) return tr("{0} kun oldin", days);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Ko'rish vaqti: bugun bo'lsa soat, aks holda sana + soat */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} · ${time}`;
}

/** User-Agent → «iPhone · Safari», «Android · Chrome», «Windows · Chrome» */
export function deviceName(ua: string | null): string {
  if (!ua) return "Noma'lum qurilma";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Qurilma";
  const browser = /Telegram/.test(ua)
    ? "Telegram"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /YaBrowser/.test(ua)
          ? "Yandex"
          : /CriOS|Chrome\//.test(ua)
            ? "Chrome"
            : /FxiOS|Firefox\//.test(ua)
              ? "Firefox"
              : /Safari\//.test(ua)
                ? "Safari"
                : "";
  return browser ? `${os} · ${browser}` : os;
}

/** Faollik darajasi nuqtasi — avatar burchagida */
export function LevelDot({ level, size = 12 }: { level: EngagementLevel; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-0 right-0 rounded-full ring-2 ring-white"
      style={{ width: size, height: size, backgroundColor: LEVEL_META[level].color }}
    />
  );
}

/** Ustunli grafik: oxirgi ustun (bugun) tizim rangida, qolganlari uning 35% i */
export function BarChart({
  values,
  labels,
  titles,
  height = 140,
  highlightLast = true,
  empty,
}: {
  values: number[];
  labels: ReactNode[];
  titles: string[];
  height?: number;
  highlightLast?: boolean;
  empty?: ReactNode;
}) {
  const max = Math.max(...values, 1);
  const allZero = values.every((v) => v === 0);
  return (
    <div>
      <div className="relative flex items-end gap-[3px] sm:gap-1.5" style={{ height }}>
        {values.map((v, i) => {
          const last = highlightLast && i === values.length - 1;
          return (
            <div key={i} className="flex h-full min-w-0 flex-1 items-end" title={titles[i]}>
              <span
                className="w-full rounded-[6px] transition-[height] duration-500"
                style={{
                  height: v > 0 ? `${Math.max(5, (v / max) * 100)}%` : "3%",
                  backgroundColor: v > 0 ? "var(--color-primary)" : "#767680",
                  opacity: v > 0 ? (last ? 1 : 0.35) : 0.12,
                }}
              />
            </div>
          );
        })}
        {allZero && empty && <p className="absolute inset-x-0 top-1/3 text-center text-[13px] text-[#8e8e93]">{empty}</p>}
      </div>
      <div className="mt-2 flex gap-[3px] sm:gap-1.5">
        {labels.map((l, i) => (
          <span
            key={i}
            className={clsx(
              "flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap text-[11px] tabular-nums",
              highlightLast && i === labels.length - 1 ? "font-semibold text-[var(--color-text)]" : "text-[#8e8e93]",
            )}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ingichka progress chizig'i (kulrang yo'lak) */
export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
    </div>
  );
}

/** Kun nomi: «Du», «Se» ... (grafik osti) */
export function weekdayShort(dateKey: string, tr: Tr): string {
  const names = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
  return tr(names[new Date(`${dateKey}T00:00:00`).getDay()]);
}

/** «13.11» */
export function dayMonth(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${d}.${m}`;
}
