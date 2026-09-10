import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export type FieldStatus = "neutral" | "success" | "error";

interface StatusInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  status?: FieldStatus;
}

const statusStyles: Record<FieldStatus, string> = {
  neutral: "border-[var(--color-border)] bg-white focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20",
  success: "border-[#86efac] bg-[#f0fdf4] focus:border-[#86efac] focus:ring-[#86efac]/30",
  error: "border-[#fca5a5] bg-[#fef2f2] focus:border-[#fca5a5] focus:ring-[#fca5a5]/30",
};

export const StatusInput = forwardRef<HTMLInputElement, StatusInputProps>(
  ({ label, error, status = "neutral", className, id, ...props }, ref) => {
    return (
      <label className="block" htmlFor={id}>
        {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "w-full rounded-2xl border px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-gray-400 outline-none transition-colors duration-200 focus:ring-2",
            statusStyles[status],
            className,
          )}
          {...props}
        />
        {error && <span className="mt-1 block text-xs text-[#dc2626]">{error}</span>}
      </label>
    );
  },
);
StatusInput.displayName = "StatusInput";
