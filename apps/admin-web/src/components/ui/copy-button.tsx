"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckIcon, CopyIcon } from "./icons";

/**
 * Matnni buferga ko'chiradi. Ikki yo'l bilan:
 *
 *  1. Zamonaviy `navigator.clipboard` — u faqat xavfsiz manbada (https yoki
 *     localhost) mavjud va foydalanuvchi ruxsatini talab qiladi;
 *  2. u ishlamasa — eski `document.execCommand("copy")`. Bu muhim: panel
 *     ichki tarmoq manzili orqali (http://192.168.x.x:3101) ochilsa, manba
 *     xavfsiz hisoblanmaydi va birinchi yo'l umuman yo'q bo'ladi.
 *
 * Ikkalasi ham ishlamasa, tugma jim qolmasdan xato holatini ko'rsatadi.
 */
function copyText(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  // Ekranda ko'rinmasin va sahifa sakramasin
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/**
 * Nusxalash tugmasi. Bosilgach ~1,6 soniyaga belgisi "bajarildi" ga
 * almashadi — aks holda nusxalangan-nusxalanmagani bilinmaydi.
 */
export function CopyButton({
  value,
  label = "Nusxalash",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  // Komponent yo'q qilinganda taymer holatni yangilamasligi kerak
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      // Ruxsat yo'q yoki manba xavfsiz emas — eski usulga o'tamiz
      ok = copyText(value);
    }
    setState(ok ? "copied" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={state === "copied" ? "Nusxalandi" : state === "failed" ? "Nusxalab bo'lmadi" : label}
      aria-label={label}
      className={clsx(
        "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)]",
        state === "copied"
          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
          : state === "failed"
            ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]",
        className,
      )}
    >
      {state === "copied" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  );
}
