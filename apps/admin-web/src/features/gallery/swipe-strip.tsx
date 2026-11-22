"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTr } from "@/i18n/tr";

/**
 * Barmoq bilan varaqlanadigan suratlar tasmasi (bitta ishning 1–5 rasmi):
 * har surat to'liq kenglikda, `scroll-snap` bilan joyiga o'tiradi; burchakda
 * «2/5», ostida nuqtalar. Kompyuterda chap/o'ng tugmalar ham chiqadi
 * (sichqoncha bilan surib bo'lmaydi). Bitta surat bo'lsa — oddiy rasm.
 */
export function SwipeStrip({
  count,
  renderSlide,
  startIndex = 0,
  onIndexChange,
  dark = false,
  frameClassName,
  dotsClassName,
  accent = "var(--color-primary)",
  fill = false,
  label,
}: {
  count: number;
  renderSlide: (index: number) => ReactNode;
  startIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Qora fon ustida (butun ekran ko'rish) — oq nuqtalar */
  dark?: boolean;
  /** Tasma o'lchami (balandlik/nisbat, burchaklar) */
  frameClassName?: string;
  dotsClassName?: string;
  /** Tanlangan nuqta rangi (yorug' fonda) */
  accent?: string;
  /** Ota blokning bo'sh balandligini to'liq egallaydi (flex ustun ichida) */
  fill?: boolean;
  label?: string;
}) {
  const tr = useTr();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(Math.min(startIndex, Math.max(0, count - 1)));

  // Ochilganda kerakli suratga darhol o'tadi (animatsiyasiz)
  useEffect(() => {
    const el = ref.current;
    if (el && startIndex > 0) el.scrollLeft = startIndex * el.clientWidth;
    // faqat birinchi chizilishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (count <= 1) return <div className={clsx("overflow-hidden", fill && "min-h-0 flex-1", frameClassName)}>{renderSlide(0)}</div>;

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const index = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    if (index !== active) {
      setActive(index);
      onIndexChange?.(index);
    }
  };
  const go = (index: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  const arrow = "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform active:scale-90 sm:flex";

  return (
    <div className={clsx(fill && "flex min-h-0 flex-1 flex-col")}>
      <div className={clsx("relative", fill && "min-h-0 flex-1")}>
        <div
          ref={ref}
          onScroll={onScroll}
          role="region"
          aria-roledescription="carousel"
          aria-label={label}
          className={clsx(
            "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            fill && "h-full",
            frameClassName,
          )}
        >
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="h-full w-full shrink-0 snap-center snap-always" aria-roledescription="slide" aria-label={tr("{0}-surat, jami {1}", i + 1, count)}>
              {renderSlide(i)}
            </div>
          ))}
        </div>

        <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-white backdrop-blur-sm">
          {active + 1}/{count}
        </span>

        {active > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(active - 1);
            }}
            aria-label={tr("Oldingi surat")}
            className={clsx(arrow, "left-2.5")}
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
          </button>
        )}
        {active < count - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(active + 1);
            }}
            aria-label={tr("Keyingi surat")}
            className={clsx(arrow, "right-2.5")}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {/* iOS sahifa nuqtalari — faqat ko'rsatkich, varaqlash barmoq bilan */}
      <div className={clsx("flex items-center justify-center gap-1.5 pt-2.5", dotsClassName)} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={clsx("h-[7px] rounded-full transition-all duration-200", i === active ? "w-[18px]" : "w-[7px]")}
            style={{
              background: i === active ? (dark ? "#fff" : accent) : dark ? "rgb(255 255 255 / 0.35)" : "rgb(118 118 128 / 0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
