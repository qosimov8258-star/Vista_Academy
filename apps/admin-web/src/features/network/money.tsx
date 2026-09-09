"use client";

import clsx from "clsx";

/** Katta summalar jadval ustunlarida tekis tursin — bir xil kenglikdagi raqamlar. */
export function formatSum(value: number): string {
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Math.round(value));
}

/** 91 300 000 -> "91,3 mln" — sarlavha kartochkalarida to'liq raqam sig'maydi. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mlrd`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} mln`;
  if (abs >= 1_000) return `${Math.round(value / 1000)} ming`;
  return formatSum(value);
}

/**
 * Yig'ilgan/qarz nisbatini ko'rsatadigan ikki rangli yo'lak.
 * Raqamning o'zi ozgina narsa aytadi — nisbat bir qarashda ko'rinishi kerak.
 */
export function SplitBar({
  collected,
  billed,
  className,
}: {
  collected: number;
  billed: number;
  className?: string;
}) {
  const percent = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 0;
  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-[var(--color-danger)]/15", className)}>
      <div
        className="h-full rounded-full bg-[var(--color-success)] shadow-[inset_0_-1px_0_rgba(255,255,255,0.25)] transition-[width] duration-500 ease-[var(--ease-out)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
