"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, assetUrl } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import type { DashboardAnalytics } from "@/lib/types";
import { expiryLabel, formatDayMonth, initials } from "@/lib/format";
import { BellIcon, SearchIcon } from "@/components/ui/icons";
import { ZeeronWordmark } from "./sidebar";

export function Topbar() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const displayName = user?.fullName || user?.login || "";
  const avatarSrc = assetUrl(user?.avatarUrl);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/bogchalar?search=${encodeURIComponent(q)}` : "/bogchalar");
  };

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-3 bg-[var(--color-bg)]/90 px-4 backdrop-blur-sm sm:px-6">
      <Link href="/" className="md:hidden">
        <ZeeronWordmark className="text-[22px]" />
      </Link>

      <form onSubmit={submitSearch} role="search" className="ml-auto hidden w-full max-w-[300px] sm:block">
        <label className="flex h-11 items-center gap-2.5 rounded-full bg-[var(--color-surface)] px-4 shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/25">
          <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-text-muted)]" />
          <span className="sr-only">Bog&apos;cha qidirish</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Bog'cha qidirish..."
            // Fokus halqasi butun "pill"da (label focus-within) — input'ning o'z chizig'i ortiqcha
            style={{ outline: "none" }}
            className="w-full bg-transparent text-[14px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
          />
        </label>
        <button type="submit" className="sr-only">
          Qidirish
        </button>
      </form>

      <div className="flex items-center gap-2.5">
        <NotificationsButton />
        {user && (
          <Link
            href="/profile"
            title={displayName}
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] text-[13px] font-semibold text-[var(--color-text)] shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials(displayName)
            )}
          </Link>
        )}
      </div>
    </header>
  );
}

/** Muddati tugayotgan / o'tgan obunalar — operator e'tiborini talab qiladi. */
function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Dashboard'dagi "Oy" so'rovi bilan bir xil kalit — kesh umumiy
  const { data } = useQuery({
    queryKey: ["dashboard", "analytics", "month"],
    queryFn: () => api.get<DashboardAnalytics>("/platform/dashboard/analytics?period=month"),
    staleTime: 60_000,
  });
  const items = data?.expiring ?? [];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={items.length > 0 ? `Bildirishnomalar: ${items.length} ta` : "Bildirishnomalar"}
        className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <BellIcon className="h-[19px] w-[19px]" />
        {items.length > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--color-danger)] ring-2 ring-[var(--color-surface)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[52px] z-40 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px] bg-[var(--color-surface)] shadow-[var(--shadow-raised)] ring-1 ring-[var(--color-border)]">
          <div className="border-b border-[var(--color-separator)] px-4 py-3">
            <p className="text-[14px] font-semibold text-[var(--color-text)]">Obuna muddatlari</p>
            <p className="text-[12px] text-[var(--color-text-muted)]">Tugagan va 14 kun ichida tugaydiganlar</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">Hozircha hammasi joyida</p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-[var(--color-separator)] overflow-y-auto">
              {items.map((item) => {
                const expiry = expiryLabel(item.periodEnd);
                return (
                  <li key={item.organization.id}>
                    <Link
                      href={`/bogchalar/${item.organization.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-[var(--color-text)]">{item.organization.name}</p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">
                          {item.plan.name} · {formatDayMonth(item.periodEnd)}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                          expiry.tone === "danger"
                            ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                            : expiry.tone === "warning"
                              ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                        )}
                      >
                        {expiry.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
