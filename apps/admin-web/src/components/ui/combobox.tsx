"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export interface ComboboxItem {
  id: string;
  name: string;
}

interface ComboboxProps {
  label?: string;
  items: ComboboxItem[];
  value: string;
  onSelect: (name: string) => void;
  onCreate: (name: string) => void;
  creating?: boolean;
  placeholder?: string;
  error?: string;
  createLabel?: string;
}

export function Combobox({
  label,
  items,
  value,
  onSelect,
  onCreate,
  creating,
  placeholder,
  error,
  createLabel = "Yangi lavozim yaratish",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const filtered = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  );

  const canCreate = query.trim().length >= 2 && !creating;

  const handleSelect = (name: string) => {
    onSelect(name);
    setQuery(name);
    setOpen(false);
  };

  const handleCreate = () => {
    const name = query.trim();
    if (name.length < 2) return;
    onCreate(name);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      {label && <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>}
      <input
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            e.preventDefault();
            const exact = items.find((item) => item.name.toLowerCase() === query.trim().toLowerCase());
            if (exact) handleSelect(exact.name);
            else if (filtered.length > 0) handleSelect(filtered[0].name);
            else if (canCreate) handleCreate();
          }
        }}
        className={clsx(
          "w-full rounded-2xl border px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-gray-400 outline-none transition-colors duration-200 focus:ring-2",
          error
            ? "border-[#fca5a5] bg-[#fef2f2] focus:border-[#fca5a5] focus:ring-[#fca5a5]/30"
            : "border-[var(--color-border)] bg-white focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20",
        )}
      />
      {open && (
        <div className="absolute z-10 mt-1.5 max-h-56 w-full overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Mos lavozim topilmadi</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.name)}
              className={clsx(
                "block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)]",
                item.name === value && "bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]",
              )}
            >
              {item.name}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            disabled={!canCreate}
            onClick={handleCreate}
            className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Yaratilmoqda..." : `+ ${createLabel}`}
          </button>
        </div>
      )}
      {error && <span className="mt-1 block text-xs text-[#dc2626]">{error}</span>}
    </div>
  );
}
