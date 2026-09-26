"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChildAllergy, MenuEntry, MenuMeal } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { AlertIcon, ChevronRightIcon, PencilIcon } from "@/components/ui/icons";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { todayTashkent } from "@/features/desk/shared";
import { MEALS } from "@/features/nutrition/use-menu-photos";
import { MEAL_LOOK } from "./meal-card";
import styles from "./chef.module.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

const FIELD: Record<MenuMeal, "breakfast" | "lunch" | "snack"> = { BREAKFAST: "breakfast", LUNCH: "lunch", SNACK: "snack" };

const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
function mondayOf(iso: string): string {
  const day = utc(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}
const dayTitle = (iso: string) => `${WEEKDAYS[utc(iso).getUTCDay()]}, ${utc(iso).getUTCDate()}-${MONTHS[utc(iso).getUTCMonth()]}`;
function weekLabel(start: string): string {
  const a = utc(start);
  const b = utc(addDays(start, 6));
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

/**
 * Oshpazning "Menyu" bo'limi — telefon uchun. Jadval o'rniga tepada hafta
 * kunlari tasmasi, ostida tanlangan kunning uchta ovqati. Ovqat bosilsa
 * pastdan tahrirlash oynasi chiqadi. Menyuda allergiyasi bor bola uchun
 * xavfli so'z uchrasa, shu kunning o'zida ogohlantiriladi.
 */
export function ChefMenu({ slug }: { slug: string }) {
  const { user } = useAuth();
  const branchId = user?.branchId ?? "";
  const today = todayTashkent();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<MenuMeal | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, weekStart],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${weekStart}&to=${days[6]}`),
    enabled: !!branchId,
  });
  const allergiesQuery = useQuery({
    queryKey: ["allergies", slug, branchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const byDate = useMemo(() => new Map((menuQuery.data ?? []).map((e) => [e.date.slice(0, 10), e])), [menuQuery.data]);
  const entry = byDate.get(selected) ?? null;

  // Menyu ham, allergiya ham erkin matn: allergen so'zlari ovqat nomida
  // (harf katta-kichikligidan qat'i nazar) qidiriladi — o'tkazib yuborgandan
  // ortiqcha ogohlantirish yaxshiroq.
  const warnings = useMemo(() => {
    if (!entry || !allergiesQuery.data?.length) return [];
    const result: { meal: string; token: string; child: string }[] = [];
    for (const { meal, short } of MEALS) {
      const text = entry[FIELD[meal]]?.toLowerCase();
      if (!text) continue;
      for (const a of allergiesQuery.data) {
        for (const token of a.allergies.split(/[,;]/).map((t) => t.trim()).filter((t) => t.length >= 2)) {
          if (text.includes(token.toLowerCase())) result.push({ meal: short, token, child: a.child.fullName });
        }
      }
    }
    return result;
  }, [entry, allergiesQuery.data]);

  const goWeek = (delta: number) => {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelected(delta === 0 ? today : next <= today && today <= addDays(next, 6) ? today : next);
  };

  return (
    <div className="mx-auto max-w-[640px] space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Haftalik menyu</p>
          <h1 className="text-[24px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{weekLabel(weekStart)}</h1>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => goWeek(-1)}
            aria-label="Oldingi hafta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-xs)] active:bg-[var(--color-surface-sunken)]"
          >
            <ChevronRightIcon className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => goWeek(1)}
            aria-label="Keyingi hafta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-xs)] active:bg-[var(--color-surface-sunken)]"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Hafta kunlari tasmasi */}
      <div className="grid grid-cols-7 gap-1.5 rounded-[22px] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)]">
        {days.map((day, i) => {
          const active = day === selected;
          const filled = !!byDate.get(day) && !!(byDate.get(day)!.breakfast || byDate.get(day)!.lunch || byDate.get(day)!.snack);
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(day)}
              aria-pressed={active}
              className={clsx(
                "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
                active ? "bg-orange-500 text-white shadow-[0_6px_14px_-6px_rgba(234,88,12,0.7)]" : "active:bg-[var(--color-surface-sunken)]",
              )}
            >
              <span className={clsx("text-[11.5px] font-semibold", active ? "text-white/85" : "text-[var(--color-text-muted)]")}>{SHORT_DAYS[i]}</span>
              <span className={clsx("text-[17px] font-bold tabular-nums", !active && day === today && "text-orange-600")}>{utc(day).getUTCDate()}</span>
              <span
                className={clsx("h-1.5 w-1.5 rounded-full", filled ? (active ? "bg-white" : "bg-emerald-500") : "bg-transparent")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <h2 className="text-[17px] font-semibold text-[var(--color-text)]">{dayTitle(selected)}</h2>
        {selected === today && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11.5px] font-bold text-orange-700">Bugun</span>}
      </div>

      {warnings.length > 0 && (
        <div className="flex gap-3 rounded-[20px] border border-red-200 bg-red-50 p-3.5">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="space-y-1 text-[13.5px] leading-snug text-red-700">
            <p className="font-semibold">Menyuda allergen bor</p>
            {warnings.map((w, i) => (
              <p key={i}>
                {w.meal}: &quot;{w.token}&quot; — <b>{w.child}</b>
              </p>
            ))}
          </div>
        </div>
      )}

      {menuQuery.isLoading ? (
        <LoadingState rows={3} />
      ) : menuQuery.isError ? (
        <ErrorState message={(menuQuery.error as Error).message} />
      ) : (
        <ul className="space-y-3">
          {MEALS.map(({ meal, label }) => {
            const look = MEAL_LOOK[meal];
            const text = entry?.[FIELD[meal]];
            return (
              <li key={meal}>
                <button
                  type="button"
                  onClick={() => setEditing(meal)}
                  className="flex w-full items-start gap-3 rounded-[22px] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-card)] active:bg-[var(--color-surface-hover)]"
                >
                  <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", look.tint, look.ink)}>
                    <look.Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-[var(--color-text)]">{label}</span>
                    <span className={clsx("mt-1 block text-[15px] leading-snug", text ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]")}>
                      {text || "Kiritilmagan — qo'shish uchun bosing"}
                    </span>
                  </span>
                  <PencilIcon className="mt-1 h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <EditDaySheet
        open={!!editing}
        focus={editing}
        date={selected}
        entry={entry}
        slug={slug}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/** Kun menyusini tahrirlash — pastdan chiqadigan oyna, uchala ovqat bir joyda */
function EditDaySheet({
  open,
  focus,
  date,
  entry,
  slug,
  onClose,
}: {
  open: boolean;
  focus: MenuMeal | null;
  date: string;
  entry: MenuEntry | null;
  slug: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ breakfast: "", lunch: "", snack: "" });

  useEffect(() => {
    if (!open) return;
    setValues({ breakfast: entry?.breakfast ?? "", lunch: entry?.lunch ?? "", snack: entry?.snack ?? "" });
  }, [open, entry]);

  const save = useMutation({
    mutationFn: () =>
      api.post<MenuEntry>("/app/menu", {
        date,
        breakfast: values.breakfast.trim(),
        lunch: values.lunch.trim(),
        snack: values.snack.trim(),
      }),
    onSuccess: async () => {
      // ["menu", slug] — haftalik ro'yxat ham, bosh sahifadagi bugungi menyu ham yangilanadi
      await queryClient.invalidateQueries({ queryKey: ["menu", slug] });
      onClose();
    },
  });

  useEffect(() => {
    if (!open) {
      save.reset();
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // save.reset o'zgarmas; faqat ochilish/yopilishda ishlaydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menyuni tahrirlash">
      <div className={clsx("absolute inset-0 bg-black/40", styles.backdrop)} onClick={onClose} aria-hidden />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className={clsx(
          "absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-[var(--color-surface)] px-4 pt-2.5 shadow-[var(--shadow-modal)] md:inset-x-auto md:left-1/2 md:w-[560px] md:-translate-x-1/2",
          styles.sheet,
        )}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-black/15" aria-hidden />
        <h2 className="mt-4 text-[19px] font-semibold text-[var(--color-text)]">{dayTitle(date)}</h2>
        <p className="mt-0.5 text-[13.5px] text-[var(--color-text-muted)]">Taomlarni vergul bilan ajrating</p>

        <div className="mt-4 space-y-3">
          {MEALS.map(({ meal, label }) => {
            const look = MEAL_LOOK[meal];
            const key = FIELD[meal];
            return (
              <label key={meal} className="block">
                <span className="mb-1.5 flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text)]">
                  <span className={clsx("flex h-7 w-7 items-center justify-center rounded-xl", look.tint, look.ink)}>
                    <look.Icon className="h-4 w-4" />
                  </span>
                  {label}
                </span>
                <textarea
                  rows={2}
                  autoFocus={meal === focus}
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  placeholder="Masalan: mastava, palov, salat"
                  className="w-full resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3.5 py-3 text-[16px] leading-snug text-[var(--color-text)] outline-none focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </label>
            );
          })}
        </div>

        {save.isError && (
          <p className="mt-3 rounded-2xl bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]">
            {(save.error as Error).message}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-[var(--color-surface-sunken)] text-[15px] font-semibold text-[var(--color-text)] active:bg-black/[0.06]"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="h-12 flex-[1.4] rounded-2xl bg-orange-500 text-[15px] font-semibold text-white shadow-[0_8px_18px_-8px_rgba(234,88,12,0.8)] active:bg-orange-600 disabled:opacity-60"
          >
            {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
