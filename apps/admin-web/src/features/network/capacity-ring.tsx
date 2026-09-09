/**
 * To'lganlik halqasi: o'rtasida bolalar soni, tashqarisida sig'im.
 * Nisbat bir qarashda ko'rinsin — raqamni o'qishga hojat qolmaydi.
 */
export function CapacityRing({
  value,
  total,
  ringClass,
  size = 68,
}: {
  value: number;
  total: number;
  ringClass: string;
  size?: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;

  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-[var(--color-surface-sunken)]" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={ringClass}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[15px] font-bold text-[var(--color-text)]">{value}</span>
        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">/ {total}</span>
      </div>
    </div>
  );
}
