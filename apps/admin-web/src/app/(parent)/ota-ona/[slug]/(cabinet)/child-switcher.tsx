"use client";

import Link from "next/link";
import type { ParentChild } from "@/lib/types";
import { initials } from "@/components/ui/avatar";
import { useTr } from "@/i18n/tr";

/**
 * Kabinet tepasida tanlangan farzand: ismi, guruhi va almashtirish tugmasi.
 * Faqat bir nechta farzand bo'lganda ko'rsatiladi.
 */
export function ChildSwitcher({ slug, child }: { slug: string; child: ParentChild }) {
  const tr = useTr();
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[var(--p-radius)] bg-[var(--p-card)] p-3 shadow-[var(--p-shadow)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--p-sun)]/20 text-[14px] font-bold text-[var(--p-sun-ink)]">
        {initials(child.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-[var(--p-ink)]">{tr(child.fullName)}</p>
        {child.group && <p className="truncate text-[13px] text-[var(--p-muted)]">{tr(child.group.name)}</p>}
      </div>
      <Link
        href={`/ota-ona/${slug}/tanlash`}
        className="shrink-0 rounded-full bg-[var(--p-panel)] px-3.5 py-2 text-[13px] font-semibold text-[var(--p-ink)]"
      >
        {tr("Farzandni almashtirish")}
      </Link>
    </div>
  );
}
