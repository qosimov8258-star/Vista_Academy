"use client";

import { useEffect, useRef, useState } from "react";
import { alternatingDirection, staggerDelay, useReveal } from "./reveal";

const STATS = [
  { value: 1000, label: "o'quvchi" },
  { value: 80, label: "professional o'qituvchi" },
  { value: 45, label: "jihozlangan sinf xonalari" },
];

const DURATION = 1400;

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return value;
}

function StatItem({ value, label, index }: { value: number; label: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = useCountUp(value, active);

  return (
    <div
      ref={ref}
      className={`reveal reveal-${alternatingDirection(index)} text-center ${active ? "reveal-visible" : ""}`}
      style={{ transitionDelay: `${staggerDelay(index)}ms` }}
    >
      <p
        className="font-heading text-[30px] font-extrabold leading-none sm:text-[44px] lg:text-[56px]"
        style={{
          backgroundImage: "linear-gradient(90deg, var(--color-blue) 0%, var(--color-green) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {count}+
      </p>
      <p className="mt-2 text-[12px] text-[var(--color-text-muted)] sm:text-[15px]">{label}</p>
    </div>
  );
}

export function Stats() {
  return (
    <section id="about" className="py-20 sm:py-28">
      <div className="mx-auto max-w-[720px] px-4 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
          Biz haqimizda
        </p>
        <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
          Vista bog&apos;chasi haqida
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
          Vista Academy — farzandingizning har bir kuni bilim, mehr va xavfsizlik bilan
          to&apos;la o&apos;tishini ta&apos;minlaydigan zamonaviy bog&apos;cha. Malakali
          tarbiyachilarimiz va zamonaviy jihozlangan sinflarimiz bilan har bir bolaga
          individual yondashamiz va uni maktab hayotiga ishonch bilan tayyorlaymiz.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-[720px] grid-cols-3 gap-3 px-4 sm:gap-6">
        {STATS.map((stat, index) => (
          <StatItem key={stat.label} value={stat.value} label={stat.label} index={index} />
        ))}
      </div>
    </section>
  );
}
