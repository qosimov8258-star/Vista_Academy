import type { ReactNode } from "react";
import { AlertIcon, InfoIcon } from "./icons";

/**
 * Yuklanish. Ro'yxat kutilayotgan joyda aylanadigan halqa emas, mazmun
 * shakliga o'xshash "skelet" ko'rsatiladi — sahifa sakramaydi va nima
 * kelayotgani oldindan ko'rinadi.
 */
export function LoadingState({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2.5" role="status" aria-busy="true" aria-label={label ?? "Yuklanmoqda"}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)]"
          // Qatorlar bir vaqtda emas, ketma-ket "nafas oladi"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] bg-[var(--color-danger-bg)] px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        <AlertIcon className="h-[26px] w-[26px]" />
      </span>
      <p className="text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-danger)]">
        Xatolik yuz berdi
      </p>
      <p className="max-w-[320px] text-[15px] text-[var(--color-danger)]/80">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
        {icon ?? <InfoIcon className="h-[26px] w-[26px]" />}
      </span>
      <p className="text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">{title}</p>
      {description && <p className="max-w-[320px] text-[15px] text-[var(--color-text-muted)]">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
