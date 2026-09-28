"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@/components/ui/icons";
import { ChevronRightIcon } from "@/components/ui/icons";
import styles from "./teacher.module.css";

/**
 * Tarbiyachi kabinetining iOS uslubidagi qurilish bloklari. Ikonkalar
 * rangli "squircle" ichida emas — o'zi tizim rangida chiziladi (iOS'ning
 * Eslatmalar, Pochta ilovalaridagi kabi). Shu sabab bu yerda `IosIcon`
 * ishlatilmaydi.
 */

/** Sahifa ustuni: telefonda 16px chekka (iOS), kompyuterda markazda tor ustun. */
export function TeacherPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx(styles.page, "-mx-2 space-y-7 sm:mx-auto sm:max-w-[720px]", className)}>{children}</div>
  );
}

/** iOS'ning katta sarlavhasi: tepada kichik izoh (sana), ostida qalin nom. */
export function LargeTitle({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-2">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-[32px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--color-text)] sm:text-[34px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[15px] leading-snug text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0 pb-1">{trailing}</div>}
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
  return (
    <section>
      {(title || action) && (
        <div className="mb-2 flex items-end justify-between gap-3 px-4">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{title}</h2>}
          {action}
        </div>
      )}
      <div className={clsx(styles.group, "overflow-hidden", className)}>{children}</div>
      {footer && <p className="mt-2 px-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">{footer}</p>}
    </section>
  );
}

/** Guruh sarlavhasi yonidagi matnli tugma ("Barchasi", "Tozalash" va h.k.). */
export function GroupAction({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const className = "text-[15px] font-medium text-[var(--color-primary)] transition-opacity active:opacity-50";
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
 * Ro'yxatdagi bitta qator. Chap tomonda — tizim rangidagi oddiy belgi yoki
 * ixtiyoriy `leading` (masalan bola surati). Qatorlar orasidagi chiziq
 * matndan boshlanadi (iOS kabi).
 */
export function Row({
  icon: Icon,
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
  const hasLeading = !!Icon || !!leading;
  const showChevron = chevron ?? (!!href || !!onClick);
  const content = (
    <>
      {!first && (
        <span
          className={clsx("absolute right-0 top-0 h-px bg-[var(--color-separator)]", hasLeading ? (leading ? "left-[68px]" : "left-[52px]") : "left-4")}
          aria-hidden="true"
        />
      )}
      {Icon && (
        <Icon
          className={clsx("h-[22px] w-[22px] shrink-0", tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]")}
          strokeWidth={1.8}
        />
      )}
      {leading}
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block truncate text-[16px] leading-snug",
            tone === "danger" ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-text)]",
          )}
        >
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-[13.5px] leading-snug text-[var(--color-text-muted)]">{subtitle}</span>}
      </span>
      {value != null && <span className="shrink-0 text-[15px] tabular-nums text-[var(--color-text-muted)]">{value}</span>}
      {trailing}
      {showChevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c4c4c7]" />}
    </>
  );
  const className = clsx("relative flex min-h-[52px] w-full items-center gap-3.5 px-4 py-2.5 text-left", (href || onClick) && styles.pressable);
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clsx(className, "cursor-pointer")}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
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
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div role="radiogroup" aria-label={label} className={clsx(styles.segmented, className)}>
      <span
        className={styles.segmentThumb}
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
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
            {option.label}
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
    "inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 text-[16.5px] font-semibold text-white shadow-[var(--shadow-primary)] disabled:opacity-50",
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

/** Bo'sh holat — ro'yxat kartasi ichida, markazda. */
export function EmptyRow({ icon: Icon, title, description }: { icon?: ComponentType<IconProps>; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-9 text-center">
      {Icon && <Icon className="h-8 w-8 text-[var(--color-text-muted)]/60" strokeWidth={1.6} />}
      <p className="mt-3 text-[16px] font-semibold text-[var(--color-text)]">{title}</p>
      {description && <p className="mt-1 max-w-[300px] text-[14px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>}
    </div>
  );
}

/** Ro'yxat yuklanayotganda — kulrang "skelet" qatorlar. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="relative flex items-center gap-3.5 px-4 py-3.5">
          {i > 0 && <span className="absolute left-4 right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-black/[0.06]" />
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
