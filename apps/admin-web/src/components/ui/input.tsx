import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";
import { ChevronDownIcon } from "./icons";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

// 44px balandlik — iOS teginish minimumi; halqa yumshoq va keng, qattiq
// 2px kontur o'rniga. Fon `white` emas, token: qora rejim qo'shilsa ham ishlaydi.
const fieldBase =
  "w-full h-11 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    return (
      <label className="block" htmlFor={id}>
        {label && <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={clsx(fieldBase, error && "border-[var(--color-danger)]", className)}
          {...props}
        />
        {hint && !error && <span className="mt-1.5 block text-[13px] text-[var(--color-text-muted)]">{hint}</span>}
        {error && <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{error}</span>}
      </label>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps
>(({ label, error, hint, className, id, ...props }, ref) => {
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{label}</span>}
      <textarea
        ref={ref}
        id={id}
        className={clsx(fieldBase, "h-auto min-h-[88px] py-3", error && "border-[var(--color-danger)]", className)}
        {...props}
      />
      {hint && !error && <span className="mt-1.5 block text-[13px] text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{error}</span>}
    </label>
  );
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps
>(({ label, error, hint, className, id, children, ...props }, ref) => {
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
      <select ref={ref} id={id} className={clsx(fieldBase, "bg-white", error && "border-[var(--color-danger)]", className)} {...props}>
        {children}
      </select>
      {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>}
    </label>
  );
});
Select.displayName = "Select";
