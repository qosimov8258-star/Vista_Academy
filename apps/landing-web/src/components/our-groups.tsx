"use client";

import { useState } from "react";
import Link from "next/link";
import type { Group } from "@/lib/groups";
import { alternatingDirection, staggerDelay, useReveal } from "./reveal";

const INITIAL_VISIBLE = 10;

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function GroupTile({ group, index }: { group: Group; index: number }) {
  const { ref, visible, style } = useReveal<HTMLAnchorElement>(staggerDelay(index, 70, 560));
  const revealClass = `reveal reveal-${alternatingDirection(index)} ${visible ? "reveal-visible" : ""}`;

  if (group.image) {
    return (
      <Link
        ref={ref}
        href={`/guruhlar/${group.slug}`}
        className={`relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-white shadow-[var(--shadow-card)] transition-transform duration-150 hover:scale-[1.03] ${revealClass}`}
        style={style}
      >
        {/* object-contain — admin panelidagi kabi rasm hech kesilmasdan to'liq ko'rinadi (turli o'lchamdagi rasmlar mobilda ham buzilib qolmasin) */}
        {/* eslint-disable-next-line @next/next/no-img-element -- statik yoki API'dan kelgan dinamik rasm */}
        <img src={group.image} alt={`${group.name} guruhi`} className="absolute inset-0 h-full w-full object-contain" />
      </Link>
    );
  }

  return (
    <Link
      ref={ref}
      href={`/guruhlar/${group.slug}`}
      className={`flex aspect-square flex-col items-center justify-center rounded-[var(--radius-md)] p-4 text-center shadow-[var(--shadow-card)] transition-transform duration-150 hover:scale-[1.03] ${revealClass}`}
      style={{ background: group.color, ...style }}
    >
      <span className="text-[13px] font-bold text-white/70">{index + 1}</span>
      <p className="font-heading mt-1 text-[16px] font-bold leading-tight text-white">{group.name}</p>
    </Link>
  );
}

export function OurGroups({ groups }: { groups: Group[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleGroups = expanded ? groups : groups.slice(0, INITIAL_VISIBLE);

  return (
    <section id="guruhlar" className="py-20 sm:py-28" style={{ background: "var(--color-tint)" }}>
      <div className="mx-auto max-w-[720px] px-4 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
          20 ta sara guruh
        </p>
        <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
          Guruhlarimiz
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
          Har bir guruhimiz o&apos;ziga xos, quvnoq nomga ega — farzandingiz tez orada
          o&apos;z guruhini sevib qoladi.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-[1120px] grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleGroups.map((group, index) => (
          <GroupTile key={group.slug} group={group} index={index} />
        ))}
      </div>

      {groups.length > INITIAL_VISIBLE && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[15px] font-bold text-white"
            style={{ background: "var(--color-green)" }}
          >
            {expanded ? "Kamroq ko'rsatish" : "Yana ko'rsatish"}
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}
    </section>
  );
}
