"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";

const MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

/** Bog'chaga boradigan yosh — shu oraliqdagi yillar ko'rsatiladi. */
const YEARS_BACK = 10;

const selectClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-shadow focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20";

interface Parts {
  day: string;
  month: string;
  year: string;
}

const EMPTY: Parts = { day: "", month: "", year: "" };

function daysInMonth(year: string, month: string): number {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function splitValue(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return EMPTY;
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

/** Uchtasi ham tanlangandagina to'liq sana, aks holda bo'sh satr. */
function joinParts({ day, month, year }: Parts): string {
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Tug'ilgan sanani uchta ro'yxatdan tanlash: kun, oy va yil.
 *
 * Brauzerning `type="date"` maydoni tug'ilgan sana uchun noqulay — kalendar
 * joriy oydan ochiladi va bir necha yil orqaga qaytish kerak bo'ladi. Bu yerda
 * yil darhol tanlanadi, oy esa raqam emas, nomi bilan ko'rinadi.
 *
 * Yarim to'ldirilgan holat komponentning o'z ichida saqlanadi: faqat yilni
 * tanlagan foydalanuvchining tanlovi yo'qolmasligi kerak, tashqariga esa
 * to'liq sana bo'lmaguncha bo'sh satr beriladi (sana ixtiyoriy).
 */
export function DateOfBirthInput({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  const groupId = useId();
  const [parts, setParts] = useState<Parts>(() => splitValue(value));

  // Tashqaridan kelgan qiymatga moslashamiz — masalan forma tozalanganda.
  // Yarim to'ldirilgan holatda ikkalasi ham bo'sh satr bo'ladi, ya'ni bu
  // effekt foydalanuvchi tanlaganini o'chirib yubormaydi.
  useEffect(() => {
    setParts((current) => (value === joinParts(current) ? current : splitValue(value)));
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => currentYear - i);

  // Yangilanish hodisa ichida hisoblanadi: onChange ni setParts ning
  // yangilovchi funksiyasi ichidan chaqirish React'da "render paytida boshqa
  // komponentni yangilash" ogohlantirishini beradi.
  const update = (next: Partial<Parts>) => {
    const merged = { ...parts, ...next };
    // 31-mart tanlangach fevralga o'tilsa, kun oyning oxirgi kuniga tushadi
    const max = daysInMonth(merged.year, merged.month);
    if (merged.day && Number(merged.day) > max) {
      merged.day = String(max);
    }
    setParts(merged);
    onChange(joinParts(merged));
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]" id={groupId}>
        {label}
      </span>
      <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2" role="group" aria-labelledby={groupId}>
        <select
          aria-label="Kun"
          value={parts.day}
          onChange={(e) => update({ day: e.target.value })}
          className={clsx(selectClass, error && "border-[var(--color-danger)]")}
        >
          <option value="">Kun</option>
          {Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Oy"
          value={parts.month}
          onChange={(e) => update({ month: e.target.value })}
          className={clsx(selectClass, error && "border-[var(--color-danger)]")}
        >
          <option value="">Oy</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Yil"
          value={parts.year}
          onChange={(e) => update({ year: e.target.value })}
          className={clsx(selectClass, error && "border-[var(--color-danger)]")}
        >
          <option value="">Yil</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {hint && !error && <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
