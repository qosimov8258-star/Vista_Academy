"use client";

import { InputHTMLAttributes, forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

interface PasswordVeilInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
}

const MAX_BLUR = 7;
const HANDLE_H = 18;
const TRACK_PAD = 6;

/**
 * Parolni nuqtalar o'rniga xira "parda" orqali ko'rsatadigan input. Maydon
 * ichidagi tutqichni pastga tortganda matn tiniqlashadi, qo'yib yuborilsa
 * (yoki yuqoriga surilsa) yana xiralashadi.
 */
export const PasswordVeilInput = forwardRef<HTMLInputElement, PasswordVeilInputProps>(
  ({ label, error, hint, className, id, onChange, defaultValue, value, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const fieldRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const isControlled = value !== undefined;
    // Controlled holatda parda matni to'g'ridan-to'g'ri `value`dan olinadi —
    // shu bilan tashqaridan (masalan, forma reset qilinganda) o'zgargan
    // qiymat ham darhol aks etadi, alohida sync effekt shart emas.
    const [uncontrolledText, setUncontrolledText] = useState(
      defaultValue != null ? String(defaultValue) : "",
    );
    const text = isControlled ? String(value ?? "") : uncontrolledText;
    const [openness, setOpenness] = useState(0); // 0 = xira, 1 = tiniq
    const [fieldHeight, setFieldHeight] = useState(0);

    useEffect(() => {
      const field = fieldRef.current;
      if (!field) return;
      const observer = new ResizeObserver(([entry]) => setFieldHeight(entry.contentRect.height));
      observer.observe(field);
      return () => observer.disconnect();
    }, []);

    const trackTop = TRACK_PAD;
    const trackBottom = Math.max(TRACK_PAD, fieldHeight - HANDLE_H - TRACK_PAD);

    const setOpennessFromClientY = useCallback(
      (clientY: number) => {
        const field = fieldRef.current;
        if (!field) return;
        const rect = field.getBoundingClientRect();
        const y = clientY - rect.top - HANDLE_H / 2;
        const range = trackBottom - trackTop;
        const ratio = range > 0 ? (y - trackTop) / range : 0;
        setOpenness(Math.max(0, Math.min(1, ratio)));
      },
      [trackTop, trackBottom],
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setOpennessFromClientY(e.clientY);
    };
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      setOpennessFromClientY(e.clientY);
    };
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // pointer allaqachon bo'shatilgan
      }
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 0.1;
      if (e.key === "ArrowDown") {
        setOpenness((v) => Math.min(1, v + step));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setOpenness((v) => Math.max(0, v - step));
        e.preventDefault();
      }
    };

    const blur = MAX_BLUR * (1 - openness);
    const opacity = 0.55 + openness * 0.45;
    const handleTop = trackTop + openness * (trackBottom - trackTop);

    return (
      <label className="block" htmlFor={inputId}>
        {label && <span className="mb-1.5 block text-[13px] font-medium text-[var(--color-text)]">{label}</span>}
        <div ref={fieldRef} className="relative">
          <input
            ref={ref}
            id={inputId}
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={value}
            defaultValue={defaultValue}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              if (!isControlled) setUncontrolledText(e.target.value);
              onChange?.(e);
            }}
            className={clsx(
              "w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 pr-8 text-sm text-transparent caret-[var(--color-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 disabled:opacity-50 [&::-ms-reveal]:hidden",
              error && "border-[var(--color-danger)]",
              className,
            )}
            {...props}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 right-8 z-[2] flex items-center overflow-hidden whitespace-pre pl-3.5 text-sm text-[var(--color-text)] transition-[filter,opacity] duration-300 ease-out motion-reduce:transition-none"
            style={{ filter: `blur(${blur.toFixed(2)}px)`, opacity }}
          >
            {text}
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(openness * 100)}
            aria-label="Matnni tiniqlashtirish"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            className="absolute right-2.5 z-[4] h-[18px] w-[6px] cursor-ns-resize touch-none rounded-full bg-gradient-to-b from-[var(--color-primary)]/50 to-[var(--color-primary)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),0_1px_3px_rgba(0,0,0,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2"
            style={{ top: handleTop }}
          />
        </div>
        {hint && !error && <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
        {error && <span className="mt-1.5 block text-xs text-[var(--color-danger)]">{error}</span>}
      </label>
    );
  },
);
PasswordVeilInput.displayName = "PasswordVeilInput";
