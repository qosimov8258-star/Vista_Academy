"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState } from "react";
import clsx from "clsx";
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "./icons";
import { useTr } from "@/i18n/tr";

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
  const tr = useTr();
    return (
      <label className="block" htmlFor={id}>
        {label && <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{tr(label)}</span>}
        <input
          ref={ref}
          id={id}
          className={clsx(fieldBase, error && "border-[var(--color-danger)]", className)}
          {...props}
        />
        {hint && !error && <span className="mt-1.5 block text-[13px] text-[var(--color-text-muted)]">{tr(hint)}</span>}
        {error && <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{tr(error)}</span>}
      </label>
    );
  },
);
Input.displayName = "Input";

/**
 * Parol maydoni — o'ng tomonida ko'z tugmasi: bosilsa terilgan parol
 * ko'rinadi, yana bosilsa yashirinadi. Qo'lda terilgan parolda xato
 * yo'qligini kirishdan oldin tekshirish uchun.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & FieldWrapperProps
>(({ label, error, hint, className, id, ...props }, ref) => {
  const tr = useTr();
  const [visible, setVisible] = useState(false);
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{tr(label)}</span>}
      <span className="relative block">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          className={clsx(fieldBase, error && "border-[var(--color-danger)]", className, "pr-12")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Kursor maydondan chiqib ketmasin — terishda davom etish mumkin
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? "Parolni yashirish" : tr("Parolni ko'rsatish")}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.04] hover:text-[var(--color-text)]"
        >
          {visible ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
        </button>
      </span>
      {hint && !error && <span className="mt-1.5 block text-[13px] text-[var(--color-text-muted)]">{tr(hint)}</span>}
      {error && <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{tr(error)}</span>}
    </label>
  );
});
PasswordInput.displayName = "PasswordInput";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps
>(({ label, error, hint, className, id, ...props }, ref) => {
  const tr = useTr();
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{tr(label)}</span>}
      <textarea
        ref={ref}
        id={id}
        className={clsx(fieldBase, "h-auto min-h-[88px] py-3", error && "border-[var(--color-danger)]", className)}
        {...props}
      />
      {hint && !error && <span className="mt-1.5 block text-[13px] text-[var(--color-text-muted)]">{tr(hint)}</span>}
      {error && <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{tr(error)}</span>}
    </label>
  );
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps
>(({ label, error, hint, className, id, children, ...props }, ref) => {
  const tr = useTr();
  return (
    <label className="block" htmlFor={id}>
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{tr(label)}</span>}
      <select ref={ref} id={id} className={clsx(fieldBase, "bg-white", error && "border-[var(--color-danger)]", className)} {...props}>
        {children}
      </select>
      {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{tr(hint)}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{tr(error)}</span>}
    </label>
  );
});
Select.displayName = "Select";
