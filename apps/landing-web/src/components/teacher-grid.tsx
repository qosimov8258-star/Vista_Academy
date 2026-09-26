"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { assetUrl } from "@/lib/api";
import type { LandingTeacher } from "@/lib/types";
import { alternatingDirection, staggerDelay, useReveal } from "./reveal";

function TeacherPhoto({ teacher, className }: { teacher: LandingTeacher; className?: string }) {
  return (
    <div className={className} style={{ background: "var(--color-tint-cream)" }}>
      {teacher.photoPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
        <img src={assetUrl(teacher.photoPath) ?? undefined} alt={teacher.fullName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Image src="/icon/teacher.png" alt="" width={96} height={96} className="h-auto w-[45%] max-w-[100px] opacity-80" />
        </div>
      )}
    </div>
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

function TeacherTile({ teacher, index = 0, onSelect }: { teacher: LandingTeacher; index?: number; onSelect: () => void }) {
  const { ref, visible, style } = useReveal<HTMLButtonElement>(staggerDelay(index, 80, 480));

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      className={`reveal reveal-${alternatingDirection(index)} group w-full text-center focus:outline-none ${visible ? "reveal-visible" : ""}`}
      style={style}
    >
      <TeacherPhoto
        teacher={teacher}
        className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-card)] transition-transform duration-200 group-hover:scale-[1.02] group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-green)]"
      />
      <p className="font-heading mt-4 line-clamp-1 min-h-[22px] text-[17px] font-bold text-[var(--color-text)]">{teacher.fullName}</p>
      <p
        className="mt-0.5 line-clamp-2 min-h-[30px] text-[12px] font-semibold uppercase tracking-[0.04em]"
        style={{ color: "var(--color-green)" }}
      >
        {teacher.role}
      </p>
      <p className="mx-auto mt-2 line-clamp-2 min-h-[44px] max-w-[200px] text-[13.5px] italic leading-relaxed text-[var(--color-text-muted)]">
        {teacher.bio && <>&ldquo;{teacher.bio}&rdquo;</>}
      </p>
    </button>
  );
}

export function TeacherGrid({ teachers }: { teachers: LandingTeacher[] }) {
  const [selected, setSelected] = useState<LandingTeacher | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTeacher = teachers[activeIndex];

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + teachers.length) % teachers.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % teachers.length);

  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [selected]);

  return (
    <>
      {/* Mobil: faqat bitta o'qituvchi, chap/o'ng tugmalar bilan almashadi */}
      <div className="mx-auto flex max-w-[260px] flex-col items-center gap-5 sm:hidden">
        <TeacherTile teacher={activeTeacher} onSelect={() => setSelected(activeTeacher)} />
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Oldingi o'qituvchi"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "var(--color-green)" }}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-bold text-[var(--color-text-muted)]">
            {activeIndex + 1} / {teachers.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            aria-label="Keyingi o'qituvchi"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            style={{ background: "var(--color-green)" }}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Kompyuter versiyasi: barcha o'qituvchilar to'r ko'rinishida */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
        {teachers.map((teacher, index) => (
          <TeacherTile key={teacher.id} teacher={teacher} index={index} onSelect={() => setSelected(teacher)} />
        ))}
      </div>

      {selected && <TeacherModal teacher={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function TeacherModal({ teacher, onClose }: { teacher: LandingTeacher; onClose: () => void }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(31,41,55,0.45)] p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={teacher.fullName}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-bg)] shadow-[var(--shadow-raised)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg)]/90 text-[var(--color-text)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-tint-cream)]"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
            <path d="M5 5 15 15M15 5 5 15" />
          </svg>
        </button>

        <div className="grid max-h-[85vh] grid-cols-1 overflow-y-auto sm:grid-cols-[240px_1fr] sm:overflow-visible">
          <div className="relative">
            <TeacherPhoto teacher={teacher} className="relative aspect-[4/5] w-full overflow-hidden sm:h-full sm:aspect-auto" />
            <div className="absolute inset-x-0 bottom-0 px-3 py-3 text-center" style={{ background: "var(--color-green-dark)" }}>
              <p className="font-heading text-[13px] font-bold uppercase leading-tight tracking-[0.04em] text-white">
                {teacher.role}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center px-6 py-6 sm:px-8 sm:py-8">
            <p className="font-heading text-[26px] font-bold leading-tight" style={{ color: "var(--color-green-dark)" }}>
              {teacher.fullName}
            </p>

            {teacher.bio && (
              <p className="mt-4 text-[14.5px] italic leading-relaxed text-[var(--color-text-muted)]">&ldquo;{teacher.bio}&rdquo;</p>
            )}

            {teacher.experience && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                  Tajriba va ma&apos;lumot
                </p>
                <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-[var(--color-text)]">{teacher.experience}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
