import { Card } from "./card";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneText: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-[var(--color-text)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-danger)]",
};

export function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className={clsx("mt-2 text-2xl font-semibold", toneText[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  );
}
