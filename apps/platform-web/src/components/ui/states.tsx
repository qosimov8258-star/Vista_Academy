import type { ComponentType, ReactNode, SVGProps } from "react";
import { AlertIcon, InboxIcon } from "./icons";

export function LoadingState({ label = "Yuklanmoqda..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-text-muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] px-6 py-12 text-center">
      <AlertIcon className="h-7 w-7 text-[var(--color-danger)]" />
      <p className="text-sm font-semibold text-[var(--color-danger)]">Xatolik yuz berdi</p>
      <p className="max-w-sm text-[13px] text-[var(--color-danger)]/80">{message}</p>
    </div>
  );
}

/**
 * Bo'sh holat. `compact` — panel ichida ishlatilganda: punktir ramka va katta
 * bo'shliqlar olib tashlanadi, aks holda quti ichida quti hosil bo'ladi.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = InboxIcon,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center"
          : "flex flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center"
      }
    >
      <span
        className={`mb-1 flex items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-subtle)] ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </span>
      <p className={`font-semibold text-[var(--color-text)] ${compact ? "text-[14px]" : "text-[15px]"}`}>
        {title}
      </p>
      {description && <p className="max-w-sm text-[13px] text-[var(--color-text-muted)]">{description}</p>}
      {action && <div className={compact ? "mt-2" : "mt-3"}>{action}</div>}
    </div>
  );
}

/**
 * Jadval yuklanayotganda spinner o'rniga kelajakdagi qatorlar shakli
 * ko'rsatiladi — sahifa balandligi sakramaydi va kutish qisqaroq tuyuladi.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-[var(--color-separator)]">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <span
              key={columnIndex}
              className="animate-skeleton h-3.5 rounded-full bg-[var(--color-surface-sunken)]"
              style={{
                width: columnIndex === 0 ? "22%" : `${Math.max(10, 18 - columnIndex * 2)}%`,
                animationDelay: `${rowIndex * 80}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="animate-skeleton h-48 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          style={{ animationDelay: `${index * 100}ms` }}
        />
      ))}
    </div>
  );
}
