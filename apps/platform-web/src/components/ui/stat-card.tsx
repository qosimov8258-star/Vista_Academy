import type { ComponentType, SVGProps } from "react";
import clsx from "clsx";
import { Card } from "./card";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

const toneText: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-[var(--color-text)]",
  primary: "text-[var(--color-text)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-danger)]",
};

// Ikonka fon+rang juftligi: raqamning ma'nosini bir qarashda bildiradi
const toneIcon: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
};

export function StatCard({ label, value, hint, tone = "default", icon: Icon }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--color-text-muted)]">{label}</p>
        {Icon && (
          <span
            className={clsx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
              toneIcon[tone],
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      {/* Raqamlar tabular-nums bilan: yangilanganda ustunlar sakramaydi */}
      <p className={clsx("mt-2 text-[26px] font-semibold tabular-nums leading-tight", toneText[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  );
}
