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
 * Qora fon ataylab: ustidagi sahifa iliq va och rangda, bar esa undan
 * aniq ajralib turishi va tugmalar bir qarashda ko'rinishi kerak.
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
      <div className="flex w-full max-w-[420px] items-stretch gap-1 rounded-full bg-[#16130f] p-2 shadow-[0_8px_24px_-6px_rgba(22,19,15,0.45)]">
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
                active ? "text-[#d8f24e]" : "text-white/45 active:text-white/70",
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
