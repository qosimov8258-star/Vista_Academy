"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";
import { GROUP_BLOCK, ROW_PRESS, ROW_SEPARATOR, SECTION_TITLE } from "./tokens";
import { Spinner } from "./spinner";

/**
 * Bo'lim: tepada sarlavha (va ixtiyoriy amal/spinner), ostida oq blok,
 * pastda izoh. Blok ichiga `Row` / `ListRow` qatorlari qo'yiladi.
 */
export function Group({
  title,
  action,
  refreshing,
  footer,
  bare = false,
  children,
  className,
}: {
  title?: ReactNode;
  /** Sarlavha o'ng tomonidagi havola/tugma */
  action?: ReactNode;
  /** Qayta yuklanmoqda — sarlavha yonida kichik spinner (ekran sakramaydi) */
  refreshing?: boolean;
  footer?: ReactNode;
  /** Oq blok o'rniga mazmunni o'zini qo'yish (skelet, bo'sh holat) */
  bare?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex min-h-[28px] items-end justify-between gap-3 pr-4">
          {title ? (
            <h2 className={clsx(SECTION_TITLE, "flex items-center gap-2")}>
              {title}
              {refreshing && <Spinner className="h-3.5 w-3.5 text-[#8e8e93]" label="Yangilanmoqda" />}
            </h2>
          ) : (
            <span />
          )}
          {action && <div className="pb-2 text-[13.5px] font-medium">{action}</div>}
        </div>
      )}
      {bare ? children : <div className={GROUP_BLOCK}>{children}</div>}
      {footer && <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">{footer}</p>}
    </section>
  );
}

/** Sarlavha yonidagi matnli havola ("Barchasi") */
export function GroupLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[var(--color-primary)] transition-opacity active:opacity-50">
      {children}
    </Link>
  );
}

type Pressable = { href?: string; onClick?: () => void; ariaLabel?: string };

function PressableRow({ href, onClick, ariaLabel, className, children }: Pressable & { className: string; children: ReactNode }) {
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={clsx(className, ROW_PRESS)}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={clsx(className, ROW_PRESS, "w-full text-left")}>
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}

const CHEVRON = <ChevronRightIcon className="h-[15px] w-[15px] shrink-0 text-[#c4c4c6]" strokeWidth={2.6} aria-hidden="true" />;

/**
 * Oddiy qator (Line): chapda nom va izoh, o'ngda qiymat yoki boshqaruv.
 * Bosiladigan bo'lsa (`href` / `onClick`) — o'ngda chevron.
 */
export function Row({
  leading,
  title,
  subtitle,
  value,
  chevron,
  ...press
}: Pressable & {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
}) {
  const pressable = Boolean(press.href || press.onClick);
  return (
    <div className="group/row relative">
      <PressableRow {...press} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-[var(--color-text)]">{title}</span>
          {subtitle && <span className="block truncate text-[12.5px] text-[#8e8e93]">{subtitle}</span>}
        </span>
        {value !== undefined && <span className="shrink-0 text-right text-[15px] tabular-nums text-[#8e8e93]">{value}</span>}
        {(chevron ?? pressable) && CHEVRON}
      </PressableRow>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/**
 * Ro'yxat qatori: avatar, nom (15.5px) va izoh (13px), o'ngda pill/amal.
 * `trailing` qatorning o'zida turadigan kichik doira tugma uchun —
 * u qator bosilishidan alohida ishlaydi.
 */
export function ListRow({
  avatar,
  title,
  subtitle,
  meta,
  trailing,
  chevron,
  ...press
}: Pressable & {
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  const pressable = Boolean(press.href || press.onClick);
  return (
    <div className="group/row relative flex items-center">
      <PressableRow {...press} className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-3">
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-medium leading-snug text-[var(--color-text)]">{title}</span>
          {subtitle && <span className="block truncate text-[13px] leading-snug text-[#8e8e93]">{subtitle}</span>}
        </span>
        {meta && <span className="flex shrink-0 items-center gap-2">{meta}</span>}
        {(chevron ?? (pressable && !trailing)) && CHEVRON}
      </PressableRow>
      {trailing && <span className="shrink-0 pr-4">{trailing}</span>}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
