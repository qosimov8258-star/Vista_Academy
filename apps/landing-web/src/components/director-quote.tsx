"use client";

import { useReveal } from "./reveal";

function QuoteMarkIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 44 34" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M0 20.2C0 9 8.6 1 19.8 1v7.6c-6 .6-9.8 4-9.8 9h9.8V34H0V20.2Z" />
      <path d="M24.2 20.2C24.2 9 32.8 1 44 1v7.6c-6 .6-9.8 4-9.8 9H44V34H24.2V20.2Z" />
    </svg>
  );
}

export function DirectorQuote() {
  const { ref, visible, style } = useReveal<HTMLDivElement>();

  return (
    <section className="py-20 sm:py-28">
      <div
        ref={ref}
        className={`reveal reveal-up mx-auto max-w-[760px] px-4 text-left ${visible ? "reveal-visible" : ""}`}
        style={style}
      >
        <QuoteMarkIcon className="h-12 w-16" style={{ color: "#e3c690" }} />

        <h2 className="font-heading mt-6 text-[22px] font-bold leading-[1.35] tracking-tight sm:text-[28px] lg:text-[34px]">
          <span style={{ color: "var(--color-blue-dark)" }}>Vista Academy</span>
          <br />
          <span style={{ color: "var(--color-green-dark)" }}>
            bilim va imkoniyatlarga yo&apos;l ochuvchi maskan.
          </span>
        </h2>

        <p className="mt-5 text-[17px] leading-relaxed text-[var(--color-text-muted)]">
          Biz farzandingiz bilan birgalikda kelajakni bunyod etib, har bir kunni unutilmas
          ta&apos;lim sayohatiga aylantirib bormoqdamiz.
        </p>

        <div className="mt-8 flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- statik brend rasmi */}
          <img src="/logo.png" alt="Vista Academy" className="h-12 w-12 shrink-0 object-contain" />

          <div className="ml-5 flex items-center gap-3">
            <span
              className="h-14 w-14 shrink-0 rounded-full"
              style={{ background: "var(--color-tint)" }}
              aria-hidden="true"
            />
            <div className="text-left">
              <p className="font-heading text-[15px] font-bold text-[var(--color-text)]">Direktor ismi</p>
              <p className="text-[14px] text-[var(--color-text-muted)]">Bosh direktor</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
