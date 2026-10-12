import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { PAGE_CARD, IOS } from "./tokens";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";

/**
 * Dashboard ko'rsatkich kartasi (CLAUDE.md §6): 30px plitka + nom, 28px
 * qiymat, yonida ixtiyoriy `Pill`, izoh va ixtiyoriy ingichka chiziq.
 * Kompyuterda 4 tadan, telefonda 2×2 to'rda ishlatiladi.
 */
export function KpiCard({
  href,
  icon,
  tint,
  label,
  value,
  valueTitle,
  valueColor,
  pill,
  hint,
  progress,
  progressColor,
}: {
  href?: string;
  icon: AnyIcon;
  tint: IosTint;
  label: string;
  /** `null` — yuklanmoqda */
  value: ReactNode | null;
  valueTitle?: string;
  valueColor?: string;
  pill?: ReactNode;
  hint?: ReactNode;
  progress?: number;
  progressColor?: string;
}) {
  const body = (
    <>
      {/* Nom va izoh tor kartada (telefon 2×2) ikki qatorgacha sig'adi — qirqilmaydi */}
      <div className="flex items-center gap-2.5">
        <IosIcon icon={icon} tint={tint} size={30} />
        <span className="line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-tight text-[#6d6d72]">{label}</span>
      </div>
      {/* Kapsula qiymat yonida — nom tor kartada qirqilib qolmasin */}
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: valueColor ?? "var(--color-text)" }} title={valueTitle}>
          {value === null ? <span className="inline-block h-7 w-16 animate-pulse rounded-lg bg-[#767680]/[0.12] align-middle" /> : value}
        </p>
        {pill}
      </div>
      {hint && <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-[#8e8e93]">{hint}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: progressColor ?? IOS.green }} />
        </div>
      )}
    </>
  );
  const className = clsx(PAGE_CARD, "flex min-w-0 flex-col p-4");
  return href ? (
    <Link href={href} className={clsx(className, "transition-transform active:scale-[0.99]")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
