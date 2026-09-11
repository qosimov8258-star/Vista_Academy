"use client";

import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { initials, roleLabel } from "@/lib/format";

export function Topbar() {
  const { user } = useAuth();

  const displayName = user?.fullName || user?.login || "";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6">
      {/* Yon panel yashiringan ekranlarda brend yuqorida ko'rinib tursin */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--color-primary)] text-xs font-bold text-white">
          B
        </div>
        <span className="text-[14px] font-semibold text-[var(--color-text)]">Platform Admin</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-full py-1 pl-2 pr-1 transition-colors duration-150 hover:bg-[var(--color-surface-hover)] md:hidden"
          >
            <div className="hidden text-right sm:block">
              <p className="text-[13px] font-medium leading-tight text-[var(--color-text)]">{displayName}</p>
              <p className="text-[11px] leading-tight text-[var(--color-text-muted)]">{roleLabel(user.role)}</p>
            </div>
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[12px] font-semibold text-[var(--color-primary)]"
            >
              {initials(displayName)}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
