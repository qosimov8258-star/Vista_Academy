"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

const GROUP_SEPARATOR = " ";

/**
 * `toLocaleString("uz-UZ")` brauzerdan brauzerga har xil ajratkich beradi
 * (ba'zilarida vergul), shuning uchun ming xonalarini o'zimiz bo'shliq bilan
 * qo'lda ajratamiz.
 */
function formatDigits(digits: string): string {
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

interface AmountInputProps {
  label?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}

/** Summa maydoni: foydalanuvchi yozayotganda ming xonalarini bo'shliq bilan ajratib ko'rsatadi (masalan 1 234 412). */
export function AmountInput({ label, value, onChange, error, hint, placeholder }: AmountInputProps) {
  const [text, setText] = useState(() => formatDigits(value !== undefined ? String(value) : ""));

  useEffect(() => {
    setText(formatDigits(value !== undefined ? String(value) : ""));
  }, [value]);

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          setText(formatDigits(digits));
          onChange(digits ? Number(digits) : undefined);
        }}
        className={clsx(
          "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-gray-400 outline-none transition-shadow focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20",
          error && "border-[var(--color-danger)]",
        )}
      />
      {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>}
    </label>
  );
}
