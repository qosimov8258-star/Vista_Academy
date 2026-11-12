"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "./icons";
import { ROW_PRESS, ROW_SEPARATOR } from "./tokens";

/**
 * Ro'yxatdan bittasini tanlash qatori (native `<select>` o'rniga) —
 * tanlangani o'ngda ✓. `GROUP_BLOCK` / `FormSection` ichida ishlatiladi.
 */
export function CheckRow({
  label,
  subtitle,
  checked,
  onClick,
  leading,
}: {
  label: ReactNode;
  subtitle?: ReactNode;
  checked: boolean;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    <div className="group/row relative">
      <button type="button" role="radio" aria-checked={checked} onClick={onClick} className={`flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left ${ROW_PRESS}`}>
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-[var(--color-text)]">{label}</span>
          {subtitle && <span className="block truncate text-[12.5px] text-[#8e8e93]">{subtitle}</span>}
        </span>
        {checked && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
      </button>
      <span className={ROW_SEPARATOR} style={leading ? { left: 58 } : undefined} aria-hidden="true" />
    </div>
  );
}
