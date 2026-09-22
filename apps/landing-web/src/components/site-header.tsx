"use client";

import { useState } from "react";
import clsx from "clsx";

type NavChild = {
  label: string;
  href: string;
};

type NavItem = {
  label: string;
  href: string;
  badge?: string;
  children?: NavChild[];
};

const GROUPS_MENU: NavChild[] = [
  { label: "Moslashuvchan jadval", href: "/jadval" },
  { label: "Sog'lom taomlar", href: "/taomlar" },
  { label: "Doimiy tarbiyachi", href: "/tarbiyachi" },
  { label: "Ta'lim yo'nalishi", href: "/talim-yonalishi" },
  { label: "O'qituvchilar", href: "/oqituvchilar" },
];

const NAV_ITEMS: NavItem[] = [
  { label: "Bosh sahifa", href: "/#top" },
  { label: "Imkoniyatlarimiz", href: "/#classrooms", children: GROUPS_MENU },
  { label: "Maktablarimiz", href: "/#schools", badge: "Tez orada" },
  { label: "Biz haqimizda", href: "/#about" },
  { label: "Bog'lanish", href: "/#contact" },
];

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 lg:px-8">
        <a href="/#top" className="flex items-center gap-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- statik brend rasmi */}
          <img src="/logo.png" alt="Vista Academy" className="h-14 w-14 object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element -- statik brend rasmi */}
          <img src="/logo-name.png" alt="Vista Academy" className="h-10 w-auto object-contain" />
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.href} className="group relative">
                <button
                  type="button"
                  className="flex items-center gap-1 text-[15px] font-semibold text-[var(--color-text)]/80 transition-colors hover:text-[var(--color-text)]"
                >
                  {item.label}
                  <ChevronDownIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" />
                </button>

                {/* Ustiga sichqoncha kelganda (yoki fokus bilan) ochiladigan ro'yxat */}
                <div className="invisible absolute left-1/2 top-full z-20 w-64 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <ul className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-2 shadow-[var(--shadow-modal,0_20px_40px_rgba(0,0,0,0.12))]">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <a
                          href={child.href}
                          className="block rounded-[var(--radius-md)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-tint)] hover:text-[var(--color-blue-dark)]"
                        >
                          {child.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-text)]/80 transition-colors hover:text-[var(--color-text)]"
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-[var(--color-yellow)]/25 px-2 py-0.5 text-[11px] font-bold text-[var(--color-yellow-dark)]">
                    {item.badge}
                  </span>
                ) : null}
                <span className="absolute -bottom-2 left-0 h-[2px] w-0 rounded-full bg-[var(--color-green)] transition-all duration-200 group-hover:w-full" />
              </a>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href="/#apply"
            className="rounded-full px-5 py-2.5 text-[15px] font-bold text-white shadow-[var(--shadow-cta)] transition-transform duration-150 hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)" }}
          >
            Ariza qoldirish
          </a>
        </div>

        <button
          type="button"
          aria-label="Menyu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] lg:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
            {open ? <path d="M5 5 15 15M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </div>

      <div
        className={clsx(
          "grid overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-bg)] transition-all duration-200 lg:hidden",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="flex flex-col gap-1 overflow-hidden px-4 py-3">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.href}>
                <button
                  type="button"
                  aria-expanded={mobileGroupsOpen}
                  onClick={() => setMobileGroupsOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 text-[15px] font-semibold text-[var(--color-text)] active:bg-[var(--color-surface)]"
                >
                  {item.label}
                  <ChevronDownIcon
                    className={clsx("h-4 w-4 transition-transform duration-200", mobileGroupsOpen && "rotate-180")}
                  />
                </button>
                <div
                  className={clsx(
                    "grid overflow-hidden transition-all duration-200",
                    mobileGroupsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden py-1 pl-4">
                    {item.children.map((child) => (
                      <a
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className="rounded-[var(--radius-md)] px-3 py-2 text-[14px] font-medium text-[var(--color-text-muted)] active:bg-[var(--color-surface)]"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 text-[15px] font-semibold text-[var(--color-text)] active:bg-[var(--color-surface)]"
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-[var(--color-yellow)]/25 px-2 py-0.5 text-[11px] font-bold text-[var(--color-yellow-dark)]">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            ),
          )}
          <div className="mt-2 flex items-center gap-3 px-3">
            <a
              href="/#apply"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full px-5 py-2.5 text-center text-[15px] font-bold text-white shadow-[var(--shadow-cta)]"
              style={{ background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)" }}
            >
              Ariza qoldirish
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
