import clsx from "clsx";

type Tone = "primary" | "success" | "warning";

const toneClasses: Record<Tone, string> = {
  primary: "bg-[var(--color-primary)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
};

/**
 * "X / Y bajarildi" holatini ko'rsatadigan yupqa yo'lak.
 *
 * Raqamning o'zi kam narsa aytadi: 12 ta davomat belgilangani ko'p yoki oz
 * ekanini bilish uchun jami nechtaligini ham ko'rish kerak. Yo'lak shu
 * nisbatni bir qarashda beradi.
 */
export function ProgressBar({
  value,
  total,
  tone = "primary",
  className,
}: {
  value: number;
  total: number;
  tone?: Tone;
  className?: string;
}) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div
      className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className={clsx("h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]", toneClasses[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
