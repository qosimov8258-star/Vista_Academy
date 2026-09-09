"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BulbIcon, HomeIcon, NoteIcon, SettingsIcon } from "@/components/ui/icons";

const TABS = [
  { href: "", label: "Bosh menu", icon: HomeIcon },
  { href: "/kundalik", label: "Kundalik", icon: NoteIcon },
  { href: "/foydali", label: "Foydali", icon: BulbIcon },
  { href: "/sozlamalar", label: "Sozlamalar", icon: SettingsIcon },
];

/**
 * Pastdagi suzuvchi menyu. Telefonda bosh barmoq yetadigan joyda turadi,
 * shuning uchun kabinetning asosiy navigatsiyasi aynan shu.
 *
 * Rangi kabinetning qolgan qismi bilan bir xil — oq yuza va iliq sariq
 * urg'u. Faol bo'lim rang bilan emas, ortidagi yumshoq tamg'a va
 * to'ldirilgan ikonka bilan ajratiladi.
 */
export function ParentTabBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/ota-ona/${slug}`;

  return (
    <nav
      aria-label="Asosiy menyu"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      // iPhone'dagi pastki chiziq tugmalarni yopib qolmasin
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex w-full max-w-[420px] items-stretch gap-1 rounded-full border border-[var(--p-line)] bg-[var(--p-card)] p-2 shadow-[var(--p-shadow)]">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-full py-2 transition-colors duration-150",
                active
                  ? "bg-[var(--p-sun)]/16 text-[#a8720a]"
                  : "text-[var(--p-muted)] active:bg-black/[0.04]",
              )}
            >
              <Icon filled={active} className="h-[22px] w-[22px]" />
              <span className="text-[11.5px] font-semibold leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
