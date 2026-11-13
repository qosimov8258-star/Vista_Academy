"use client";

import { useEffect } from "react";
import clsx from "clsx";
import type { Organization } from "@/lib/types";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/components/ui/icons";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * Bog'cha tanlagich — qidiruvli ochiluvchi ro'yxat (SaaS'lardagi «workspace» almashtirgich kabi).
 * Qidiruv serverda bajariladi: `filtered` — serverdan kelgan natija, `total` — umumiy son.
 */
export function OrgPicker({
  total,
  selected,
  open,
  onOpenChange,
  search,
  onSearch,
  filtered,
  onChoose,
  disabled,
  searching,
}: {
  total: number;
  selected: Organization | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearch: (value: string) => void;
  filtered: Organization[];
  onChoose: (id: string) => void;
  disabled?: boolean;
  searching?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? "Avval o'zgarishlarni saqlang yoki bekor qiling" : undefined}
        onClick={() => onOpenChange(!open)}
        className="flex max-w-full cursor-pointer items-center gap-3 rounded-full bg-[var(--color-surface-sunken)] py-1.5 pl-1.5 pr-4 text-left transition-colors hover:bg-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[12.5px] font-semibold text-white">
          {selected ? initials(selected.name) : "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium leading-tight text-[var(--color-text)]">{selected?.name ?? "Bog'cha tanlang"}</span>
          <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">{selected?.slug ?? `${total} ta bog'cha`}</span>
        </span>
        <ChevronDownIcon className={clsx("h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Yopish" className="fixed inset-0 z-40 cursor-default" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-[20px] bg-[var(--color-surface)] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.05)]">
            <label className="flex h-9 items-center gap-2 rounded-full bg-[var(--color-surface-sunken)] px-3">
              <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !searching && filtered[0] && onChoose(filtered[0].id)}
                placeholder="Bog'cha nomi yoki manzili"
                aria-label="Bog'cha qidirish"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
              />
            </label>
            <ul role="listbox" className="mt-1.5 max-h-[320px] space-y-0.5 overflow-y-auto">
              {filtered.map((o) => {
                const active = o.id === selected?.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => onChoose(o.id)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[12px] font-semibold text-[var(--color-text)]">
                        {initials(o.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[var(--color-text)]">{o.name}</span>
                        <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">
                          {o.subscription?.plan?.name ?? "Obunasiz"} · {o.slug}
                        </span>
                      </span>
                      {o.status === "SUSPENDED" && (
                        <span className="shrink-0 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-warning)]">To&apos;xtatilgan</span>
                      )}
                      {active && <CheckIcon className="h-4 w-4 shrink-0 text-[var(--color-text)]" />}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">{searching ? "Qidirilmoqda…" : "Topilmadi"}</li>
              )}
              {filtered.length > 0 && total > filtered.length && (
                <li className="px-3 py-2 text-center text-[11.5px] text-[var(--color-text-subtle)]">
                  {filtered.length} / {total} ko&apos;rsatildi — aniqroq qidiring
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
