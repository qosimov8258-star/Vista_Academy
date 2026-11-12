"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@/components/ios/icons";
import { ChevronRightIcon } from "@/components/ios/icons";
import { PAGE_CARD, SECTION_TITLE } from "@/components/ios/tokens";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

/**
 * Tarbiyachi kabinetining qurilish bloklari — panelning asosiy iOS uslubida
 * (admin-web CLAUDE.md): soyasiz oq kartalar (18px), qatorlarda rangli
 * plitka (`IosIcon`), sarlavha kartasi. Telefon birinchi: qatorlar ≥ 52px,
 * asosiy tugma bosh barmoq yetadigan joyda.
 */

/** Sahifa ustuni: telefonda 16px chekka (iOS), kompyuterda markazda tor ustun. Bloklar orasi 20px. */
export function TeacherPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx(styles.page, "-mx-2 space-y-5 sm:mx-auto sm:max-w-[720px]", className)}>{children}</div>
  );
}

/**
 * Sahifa sarlavhasi kartasi (PageHeaderCard bilan bir xil): tepada kichik
 * izoh (sana), 20px nom — bosh sahifada `hero` bilan 28px salomlashuv,
 * ostida izoh, o'ngda tugma/avatar. `icon` berilsa — 40px plitka
 * (telefonda yashiriladi, joy tejaladi).
 */
export function LargeTitle({
  eyebrow,
  title,
  subtitle,
  trailing,
  icon,
  tint = "accent",
  hero = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  icon?: AnyIcon;
  tint?: IosTint;
  hero?: boolean;
}) {
  const tr = useTr();
  return (
    <header className={clsx(PAGE_CARD, "flex items-center gap-3 px-4 py-4")}>
      {icon && <IosIcon icon={icon} tint={tint} size={40} className="max-sm:hidden" />}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="truncate text-[13px] text-[#8e8e93]">{tr(eyebrow)}</p>}
        <h1
          data-hero
          className={clsx(
            "truncate font-bold leading-tight text-[var(--color-text)]",
            hero ? "mt-0.5 text-[28px] tracking-[-0.02em]" : "text-[20px] tracking-[-0.01em]",
          )}
        >
          {tr(title)}
        </h1>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">{tr(subtitle)}</p>}
      </div>
      {trailing && <div className="shrink-0">{tr(trailing)}</div>}
    </header>
  );
}

/** Guruhlangan ro'yxat: sarlavha + oq yumaloq karta + izoh. */
export function Group({
  title,
  action,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tr = useTr();
  return (
    <section>
      {(title || action) && (
        <div className="flex min-h-[28px] items-end justify-between gap-3 pr-4">
          {title ? <h2 className={SECTION_TITLE}>{tr(title)}</h2> : <span />}
          {action && <div className="pb-1.5 text-[13.5px]">{tr(action)}</div>}
        </div>
      )}
      <div className={clsx(styles.group, "overflow-hidden", className)}>{children}</div>
      {footer && <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">{tr(footer)}</p>}
    </section>
  );
}

/** Guruh sarlavhasi yonidagi matnli tugma ("Barchasi", "Tozalash" va h.k.). */
export function GroupAction({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const className = "text-[13.5px] font-medium text-[var(--color-primary)] transition-opacity active:opacity-50";
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={clsx(className, "cursor-pointer")}>
      {children}
    </button>
  );
}

/**
 * Ro'yxatdagi bitta qator. Chap tomonda — rangli plitka (`icon` + `tint`)
 * yoki ixtiyoriy `leading` (masalan 44px bola surati). Qatorlar orasidagi
 * chiziq matndan boshlanadi (iOS kabi): plitkada 58px, suratda 72px.
 */
export function Row({
  icon: Icon,
  tint = "accent",
  leading,
  title,
  subtitle,
  value,
  trailing,
  href,
  onClick,
  first,
  chevron,
  tone = "default",
}: {
  icon?: ComponentType<IconProps>;
  /** Plitka rangi — har bo'limning o'z rangi (sukut: tizim rangi) */
  tint?: IosTint;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  first?: boolean;
  /** Sukut bo'yicha havola/tugma bo'lsa ko'rinadi */
  chevron?: boolean;
  tone?: "default" | "danger";
}) {
  const tr = useTr();
  const hasLeading = !!Icon || !!leading;
  const showChevron = chevron ?? (!!href || !!onClick);
  const content = (
    <>
      {!first && (
        <span
          className={clsx("absolute right-0 top-0 h-px bg-black/[0.08]", hasLeading ? (leading ? "left-[72px]" : "left-[58px]") : "left-4")}
          aria-hidden="true"
        />
      )}
      {Icon && <IosIcon icon={Icon} tint={tone === "danger" ? "red" : tint} size={30} />}
      {tr(leading)}
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block truncate text-[15.5px] leading-snug",
            tone === "danger" ? "font-medium text-[#ff3b30]" : "text-[var(--color-text)]",
          )}
        >
          {tr(title)}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-[13px] leading-snug text-[#8e8e93]">{tr(subtitle)}</span>}
      </span>
      {value != null && <span className="shrink-0 text-[15px] tabular-nums text-[#8e8e93]">{tr(value)}</span>}
      {tr(trailing)}
      {showChevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} />}
    </>
  );
  const className = clsx("relative flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left", (href || onClick) && styles.pressable);
  if (href) {
    return (
      <Link href={href} className={className}>
        {tr(content)}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clsx(className, "cursor-pointer")}>
        {tr(content)}
      </button>
    );
  }
  return <div className={className}>{tr(content)}</div>;
}

/** iOS segmented control. `tint` — tanlangan bo'lak matnining rangi (sukut: oddiy matn). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; tint?: string }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const tr = useTr();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div role="radiogroup" aria-label={tr(label)} className={clsx(styles.segmented, className)}>
      <span
        className={styles.segmentThumb}
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        aria-hidden="true"
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={clsx(styles.segment, size === "sm" && "!py-[5px] !text-[12.5px]")}
            style={active && option.tint ? { color: option.tint } : undefined}
          >
            {tr(option.label)}
          </button>
        );
      })}
    </div>
  );
}

/** To'liq kenglikdagi asosiy tugma (tizim rangida kapsula). */
export function PrimaryButton({
  children,
  onClick,
  href,
  loading,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const cls = clsx(
    styles.cta,
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 text-[16px] font-semibold text-white shadow-[0_8px_18px_-8px_color-mix(in_srgb,var(--color-primary)_55%,transparent)] disabled:opacity-50",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} className={clsx(cls, "cursor-pointer")}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * Asosiy amal paneli ("Saqlash") — telefonda pastki tab-bar ustida mahkam
 * suzib turadi, kompyuterda sahifa pastiga yopishadi. Sahifaning oxirida
 * qo'yiladi: ostidagi bo'sh joy oxirgi qator tugma ostida qolmasligi uchun.
 */
export function FloatingBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden="true" />
      {/* Tugma va tab-bar ortidagi yumshoq fon — ostidan o'tayotgan ro'yxat ko'zga tashlanmasin */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(max(12px,env(safe-area-inset-bottom))+150px)] bg-gradient-to-t from-[var(--color-bg)] from-60% to-transparent md:hidden"
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(12px,env(safe-area-inset-bottom))+70px)] z-30 px-4 md:sticky md:inset-x-auto md:bottom-4 md:px-0">
        <div className="pointer-events-auto mx-auto max-w-[440px] md:max-w-none">{children}</div>
      </div>
    </>
  );
}

/** Bo'sh holat — ro'yxat kartasi ichida, markazda. */
export function EmptyRow({ icon: Icon, title, description }: { icon?: ComponentType<IconProps>; title: string; description?: string }) {
  const tr = useTr();
  return (
    <div className="flex flex-col items-center px-6 py-9 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93]">
          <Icon className="h-6 w-6" strokeWidth={1.9} />
        </span>
      )}
      <p className="mt-3 text-[16px] font-semibold text-[var(--color-text)]">{tr(title)}</p>
      {description && <p className="mt-1 max-w-[300px] text-[13px] leading-snug text-[#8e8e93]">{tr(description)}</p>}
    </div>
  );
}

/** Ro'yxat yuklanayotganda — kulrang "skelet" qatorlar. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  const tr = useTr();
  return (
    <div aria-busy="true" aria-label={tr("Yuklanmoqda")}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="relative flex items-center gap-3.5 px-4 py-3.5">
          {i > 0 && <span className="absolute left-[72px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#767680]/[0.12]" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded-full bg-black/[0.06]" />
            <span className="block h-3 w-1/4 animate-pulse rounded-full bg-black/[0.04]" />
          </span>
        </div>
      ))}
    </div>
  );
}

const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
const WEEKDAYS_SHORT = ["yak", "dush", "sesh", "chor", "pay", "jum", "shan"];

/** "2026-09-28" → Date (mahalliy tush vaqti — kun almashib ketmasin). */
function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

/** "28-sentabr, dushanba" */
export function formatDayLong(iso: string): string {
  const d = parseDay(iso);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
}

/** "28-sen, dush" */
export function formatDayShort(iso: string): string {
  const d = parseDay(iso);
  return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}, ${WEEKDAYS_SHORT[d.getDay()]}`;
}

/** Toshkent vaqti bo'yicha bugungi sana — "YYYY-MM-DD". */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}
