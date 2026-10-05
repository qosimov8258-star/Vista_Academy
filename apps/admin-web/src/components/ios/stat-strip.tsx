import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Ko'rsatkichlar qatori: kulrang (#f2f2f7) katakchalar (varaq ichida — oq) —
 * telefonda 2×2, lg dan 4 tasi bir qatorda, orasida ingichka ajratgich.
 */
export function StatStrip({ children, tone = "gray", className }: { children: ReactNode; tone?: "gray" | "white"; className?: string }) {
  return (
    <div
      data-tone={tone}
      className={clsx("group/strip grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-[#c6c6c8]/45 lg:grid-cols-4", className)}
    >
      {children}
    </div>
  );
}

export function StatCell({
  label,
  value,
  hint,
  color,
  href,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Qiymat rangi — iOS rangi (IOS.green ...) */
  color?: string;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <span className="block truncate text-[12.5px] font-medium text-[#6d6d72]">{label}</span>
      <span className="mt-1 block text-[24px] font-bold leading-7 tabular-nums" style={{ color: color ?? "var(--color-text)" }}>
        {loading ? <span className="inline-block h-6 w-10 animate-pulse rounded-md bg-[#767680]/[0.14] align-middle" /> : value}
      </span>
      {hint && <span className="mt-0.5 block truncate text-[12px] text-[#8e8e93]">{hint}</span>}
    </>
  );
  // Oq karta ichida — kulrang katak; kulrang varaq ichida (tone="white") — oq katak
  const cell = "block min-w-0 bg-[#f2f2f7] px-4 py-3.5 group-data-[tone=white]/strip:bg-white";
  if (href) {
    return (
      <Link href={href} className={clsx(cell, "transition-colors hover:bg-[#ebebf0] active:bg-[#e5e5ea]")}>
        {body}
      </Link>
    );
  }
  return <div className={cell}>{body}</div>;
}
