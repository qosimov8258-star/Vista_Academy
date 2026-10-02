"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";
import { BuildingIcon, SearchIcon } from "@/components/ui/icons";
import { ORG_STATUS_LABEL } from "@/features/organizations/lifecycle";

export interface PaletteLink {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface Result {
  key: string;
  href: string;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Tezkor qidiruv (⌘K / Ctrl+K): bo'limlar va bog'chalar. Klaviatura bilan
 * to'liq boshqariladi — ↑/↓ tanlash, Enter ochish, Esc yopish.
 */
export function CommandPalette({ open, onClose, links }: { open: boolean; onClose: () => void; links: PaletteLink[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query.trim(), 200);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const orgsQuery = useQuery({
    queryKey: ["organizations", { search: debounced, palette: true }],
    queryFn: () => getPaginated<Organization>(`/platform/organizations?page=1&limit=6&search=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  });

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = links
      .filter((link) => !q || link.label.toLowerCase().includes(q))
      .map((link) => ({ key: `page:${link.href}`, href: link.href, label: link.label, hint: "Bo'lim", icon: link.icon }));
    const orgs = q
      ? (orgsQuery.data?.data ?? []).map((org) => ({
          key: `org:${org.id}`,
          href: `/bogchalar/${org.id}`,
          label: org.name,
          hint: `Bog'cha · ${ORG_STATUS_LABEL[org.status]}`,
          icon: BuildingIcon,
        }))
      : [];
    return [...pages, ...orgs];
  }, [links, query, orgsQuery.data]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const go = (result: Result | undefined) => {
    if (!result) return;
    onClose();
    router.push(result.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tezkor qidiruv"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[var(--shadow-modal)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-separator)] px-5">
          <SearchIcon className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Bo'lim yoki bog'cha nomi..."
            aria-label="Qidirish"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].key}` : undefined}
            className="h-14 w-full bg-transparent text-[16px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
            style={{ outline: "none" }}
          />
          <kbd className="shrink-0 rounded-md bg-[var(--color-surface-sunken)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="max-h-[360px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13.5px] text-[var(--color-text-muted)]">
              {orgsQuery.isFetching ? "Qidirilmoqda…" : "Hech narsa topilmadi"}
            </li>
          ) : (
            results.map((result, index) => {
              const Icon = result.icon;
              return (
                <li
                  key={result.key}
                  id={`palette-${result.key}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result)}
                  className={clsx(
                    "flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5",
                    index === active ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-text)]",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{result.label}</span>
                  <span className={clsx("shrink-0 text-[12px]", index === active ? "text-white/60" : "text-[var(--color-text-muted)]")}>
                    {result.hint}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
