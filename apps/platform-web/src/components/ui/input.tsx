import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

const fieldBase =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-gray-400 outline-none transition-shadow focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    return (
      <label className="block" htmlFor={id}>
        {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
        <input
          ref={ref}
          id={id}
          className={clsx(fieldBase, error && "border-[var(--color-danger)]", className)}
          {...props}
        />
        {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
        {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>}
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
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
      <textarea ref={ref} id={id} className={clsx(fieldBase, error && "border-[var(--color-danger)]", className)} {...props} />
      {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>}
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
