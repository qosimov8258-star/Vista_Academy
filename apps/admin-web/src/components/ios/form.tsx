"use client";

import { useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";
import clsx from "clsx";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { GROUP_BLOCK, ROW_SEPARATOR, SECTION_TITLE } from "./tokens";
import styles from "./ios.module.css";
import { useTr } from "@/i18n/tr";

/**
 * iOS formasi (varaq ichida): bo'lim sarlavhasi + oq blok + qatorlar.
 * Qator: chapda 108px yorliq, o'ngda ramkasiz boshqaruv; xato bo'lsa qator
 * foni och qizil va ostida qisqa sabab.
 */
export function FormSection({ title, footer, children }: { title?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && <h3 className={SECTION_TITLE}>{title}</h3>}
      <div className={GROUP_BLOCK}>{children}</div>
      {footer && <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">{footer}</p>}
    </section>
  );
}

export function FieldRow({
  label,
  htmlFor,
  error,
  children,
  stacked = false,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  /** Yorliq tepada, boshqaruv ostida to'liq kenglikda (uzun boshqaruvlar uchun) */
  stacked?: boolean;
}) {
  const tr = useTr();
  return (
    <div className={clsx("group/row relative px-4", error && "bg-[#ff3b30]/[0.06]")}>
      <div className={clsx(stacked ? "pb-2.5 pt-3" : "flex min-h-[48px] items-center gap-3")}>
        <label htmlFor={htmlFor} className={clsx("shrink-0 text-[15px] text-[var(--color-text)]", stacked ? "mb-2 block" : "w-[108px] py-3")}>
          {label}
        </label>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {error && (
        <p role="alert" className="-mt-1 pb-2.5 text-[12.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

const CONTROL = "w-full bg-transparent py-3 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6] disabled:opacity-50";

/** Ramkasiz matn maydoni (react-hook-form `register` bilan ishlaydi) */
export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={clsx(CONTROL, className)} />;
}

/** Parol maydoni — ko'z tugmasi bilan */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const tr = useTr();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input {...props} type={visible ? "text" : "password"} className={clsx(CONTROL, className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition-colors hover:bg-[#767680]/[0.12] active:scale-[0.96]"
        aria-label={visible ? tr("Parolni yashirish") : tr("Parolni ko'rsatish")}
      >
        {visible ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

/** Ramkasiz tanlagich — qiymat o'ngda, telefonda tizim tanlagichi ochiladi */
export function SelectInput({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative flex items-center justify-end">
      <select {...props} className={clsx(CONTROL, "cursor-pointer appearance-none pr-6 text-right [text-align-last:right]", className)}>
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-0 h-4 w-4 text-[#c4c4c6]" />
    </div>
  );
}

/** Summa: raqamlar guruhlab ko'rsatiladi (800 000), tashqariga — toza son satri */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  name,
  id,
  placeholder,
  suffix = "so'm",
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
  suffix?: string;
}) {
  const tr = useTr();
  const digits = (value ?? "").replace(/\D/g, "");
  const shown = digits ? Number(digits).toLocaleString("ru-RU").replace(/ /g, " ") : "";
  return (
    <div className="flex items-baseline gap-1.5">
      <input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 12))}
        onBlur={onBlur}
        className={clsx(CONTROL, "text-right tabular-nums")}
      />
      <span className="shrink-0 text-[13px] text-[#8e8e93]">{tr(suffix)}</span>
    </div>
  );
}

/** iOS segmenti: kulrang yo'lak ichida oq "tabletka" suriladi */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: "sm" | "md";
}) {
  const index = options.findIndex((option) => option.value === value);
  return (
    <div role="radiogroup" aria-label={label} className="relative grid rounded-[10px] bg-[#767680]/[0.12] p-[2px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {index >= 0 && (
        <span
          aria-hidden="true"
          className={clsx(styles.thumb, "absolute bottom-[2px] top-[2px] rounded-[8px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]")}
          style={{ left: 2, width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "relative z-[1] truncate rounded-[8px] px-2 font-medium text-[var(--color-text)] transition-opacity active:opacity-60",
            size === "sm" ? "h-7 text-[12.5px]" : "h-8 text-[13px]",
            option.value === value && "font-semibold",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** iOS switch — 51×31, yoqilganda yashil */
export function IosSwitch({ checked, onChange, label, id }: { checked: boolean; onChange: (checked: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
        checked ? "bg-[#34c759]" : "bg-[#e9e9ea]",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: checked ? "translateX(20px)" : "none" }}
      />
    </button>
  );
}

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const YEARS_BACK = 10;

interface Parts {
  day: string;
  month: string;
  year: string;
}
const EMPTY: Parts = { day: "", month: "", year: "" };
const daysIn = (year: string, month: string) => (!year || !month ? 31 : new Date(Number(year), Number(month), 0).getDate());
const split = (value: string): Parts => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) } : EMPTY;
};
const join = ({ day, month, year }: Parts) => (day && month && year ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "");

/**
 * Tug'ilgan sana — uchta kulrang kapsula: kun ▾ oy ▾ yil ▾ (tizim
 * tanlagichi). Kalendar joriy oydan ochilib yillab orqaga qaytishga
 * majbur qilmaydi. To'liq tanlanmaguncha tashqariga bo'sh satr beriladi.
 */
export function DobPicker({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  const tr = useTr();
  const autoId = useId();
  const [parts, setParts] = useState<Parts>(() => split(value));
  useEffect(() => {
    setParts((current) => (value === join(current) ? current : split(value)));
  }, [value]);

  const currentYear = new Date().getFullYear();
  const update = (next: Partial<Parts>) => {
    const merged = { ...parts, ...next };
    const max = daysIn(merged.year, merged.month);
    if (merged.day && Number(merged.day) > max) merged.day = String(max);
    setParts(merged);
    onChange(join(merged));
  };
  const pill =
    "h-9 min-w-0 cursor-pointer appearance-none rounded-full bg-[#767680]/[0.12] px-3 text-center text-[14px] text-[var(--color-text)] outline-none transition-colors hover:bg-[#767680]/[0.18] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40";
  return (
    <div id={id ?? autoId} role="group" className="flex justify-end gap-1.5 py-1.5">
      <select aria-label={tr("Kun")} value={parts.day} onChange={(e) => update({ day: e.target.value })} className={clsx(pill, "w-[64px]")}>
        <option value="">{tr("Kun")}</option>
        {Array.from({ length: daysIn(parts.year, parts.month) }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select aria-label={tr("Oy")} value={parts.month} onChange={(e) => update({ month: e.target.value })} className={clsx(pill, "w-[100px]")}>
        <option value="">{tr("Oy")}</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {tr(name)}
          </option>
        ))}
      </select>
      <select aria-label={tr("Yil")} value={parts.year} onChange={(e) => update({ year: e.target.value })} className={clsx(pill, "w-[76px]")}>
        <option value="">{tr("Yil")}</option>
        {Array.from({ length: YEARS_BACK + 1 }, (_, i) => currentYear - i).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ChevronsUpDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </svg>
  );
}
