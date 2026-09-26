"use client";

import { useState } from "react";
import Image from "next/image";
import { alternatingDirection, staggerDelay, useReveal } from "./reveal";

const GROUPS = [
  {
    image: "/icon/baby1.jpg",
    title: "Chaqaloqlar",
    age: "2 oydan 1 yoshgacha",
    color: "#ef8a63",
    arch: { topLeft: "99px", topRight: "999px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/kichkintorlar.jpeg",
    title: "Kichkintoylar",
    age: "1 dan 3 yoshgacha",
    color: "#aead45",
    arch: { topLeft: "999px", topRight: "999px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/orta-guruh.jpeg",
    title: "O'rta guruh",
    age: "3 dan 4 yoshgacha",
    color: "#cf5599",
    arch: { topLeft: "999px", topRight: "99px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/katta-guruh.jpeg",
    title: "Katta guruh",
    age: "4 dan 6 yoshgacha",
    color: "var(--color-green)",
    arch: { topLeft: "99px", topRight: "999px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/maktab.jpg",
    title: "Maktab yoshidagilar",
    age: "6 dan 12 yoshgacha",
    color: "var(--color-blue)",
    arch: { topLeft: "999px", topRight: "99px", bottomLeft: "20px", bottomRight: "20px" },
  },
];

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 14 14 6M8 6h6v6" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5l-5 5 5 5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 5l5 5-5 5" />
    </svg>
  );
}

function GroupCard({
  group,
  variant = "grid",
  index = 0,
}: {
  group: (typeof GROUPS)[number];
  variant?: "grid" | "carousel";
  index?: number;
}) {
  const { ref, visible, style } = useReveal<HTMLDivElement>(staggerDelay(index));

  return (
    <div
      ref={ref}
      className={[
        variant === "carousel"
          ? "w-full max-w-[220px] rounded-[22px] p-2"
          : "w-full max-w-[84px] rounded-[12px] p-1 sm:max-w-[176px] sm:rounded-[22px] sm:p-2 lg:max-w-[240px] lg:rounded-[32px] lg:p-3",
        "reveal",
        `reveal-${alternatingDirection(index)}`,
        visible ? "reveal-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ background: group.color, ...style }}
    >
      <div
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden"
        style={{
          borderTopLeftRadius: group.arch.topLeft,
          borderTopRightRadius: group.arch.topRight,
          borderBottomLeftRadius: group.arch.bottomLeft,
          borderBottomRightRadius: group.arch.bottomRight,
        }}
      >
        <Image
          src={group.image}
          alt={`${group.title} guruhi`}
          fill
          sizes={variant === "carousel" ? "220px" : "(min-width: 1024px) 240px, (min-width: 640px) 176px, 100px"}
          className="object-cover"
        />
      </div>
      <div
        className={
          variant === "carousel"
            ? "relative z-10 mx-1 -mt-4 rounded-xl bg-white px-2 py-1.5 text-center shadow-[var(--shadow-card)]"
            : "relative z-10 mx-1 -mt-2 rounded-lg bg-white px-1 py-1 text-center shadow-[var(--shadow-card)] sm:-mt-4 sm:rounded-xl sm:px-2 sm:py-1.5 lg:-mt-6 lg:rounded-2xl lg:px-4 lg:py-3"
        }
      >
        <p
          className={
            variant === "carousel"
              ? "font-heading text-[15px] font-bold leading-tight text-[var(--color-text)]"
              : "font-heading text-[10px] font-bold leading-tight text-[var(--color-text)] sm:text-[13px] lg:text-[16px]"
          }
        >
          {group.title}
        </p>
        <p
          className={
            variant === "carousel"
              ? "mt-0.5 text-[12px] italic leading-tight text-[var(--color-text-muted)]"
              : "mt-0.5 text-[8px] italic leading-tight text-[var(--color-text-muted)] sm:text-[11px] lg:text-[13px]"
          }
        >
          {group.age}
        </p>
      </div>
    </div>
  );
}

export function Programs() {
  const [firstRow, secondRow] = [GROUPS.slice(0, 3), GROUPS.slice(3)];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeGroup = GROUPS[activeIndex];

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + GROUPS.length) % GROUPS.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % GROUPS.length);

  return (
    <section id="classrooms" className="py-20 sm:py-28">
      <div className="mx-auto max-w-[720px] px-4 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
          Guruhlarimiz
        </p>
        <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
          Har bir yosh bosqichi uchun mos guruh
        </h2>
      </div>

      {/* Mobil: faqat bitta guruh, chap/o'ng tugmalar bilan almashadi */}
      <div className="mx-auto mt-12 flex max-w-[260px] flex-col items-center gap-5 px-4 sm:hidden">
        <GroupCard group={activeGroup} variant="carousel" />
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Oldingi guruh"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "var(--color-green)" }}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-bold text-[var(--color-text-muted)]">
            {activeIndex + 1} / {GROUPS.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            aria-label="Keyingi guruh"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "var(--color-green)" }}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Kompyuter versiyasi: barcha guruhlar to'r ko'rinishida */}
      <div className="hidden sm:block">
        <div className="mx-auto mt-12 flex max-w-[1120px] flex-wrap justify-center gap-3 px-4 sm:gap-5">
          {firstRow.map((group, index) => (
            <GroupCard key={group.title} group={group} index={index} />
          ))}
        </div>
        <div className="mx-auto mt-3 flex max-w-[560px] flex-wrap justify-center gap-3 px-4 sm:mt-5 sm:gap-5">
          {secondRow.map((group, index) => (
            <GroupCard key={group.title} group={group} index={firstRow.length + index} />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-[560px] px-4 text-center">
        <p className="text-[16px] italic leading-relaxed text-[var(--color-text-muted)]">
          Shunchaki bog&apos;cha emas — bolalar o&apos;sadigan, o&apos;rganadigan va kashf qiladigan makon.
        </p>
        <a
          href="#apply"
          className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-bold"
          style={{ color: "var(--color-yellow-dark)" }}
        >
          Batafsil ma&apos;lumot
          <ArrowUpRightIcon className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
