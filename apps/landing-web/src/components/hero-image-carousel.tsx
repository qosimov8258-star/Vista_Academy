"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * PageShell'dagi hero joyida bitta rasm o'rniga bir nechta rasmni
 * ketma-ket ko'rsatadigan slayder. Chap/o'ng tugmalari kompyuterda ham,
 * mobil ekranda ham bir xil ko'rinishda chiqadi.
 */
export function HeroImageCarousel({
  images,
  alt,
  fit = "cover",
  position = "50% 0%",
}: {
  images: string[];
  alt: string;
  fit?: "cover" | "contain";
  position?: string;
}) {
  const t = useTranslations("heroCarousel");
  const [index, setIndex] = useState(0);

  function goTo(next: number) {
    setIndex((next + images.length) % images.length);
  }

  return (
    <>
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- statik rasmlar to'plami
        <img
          key={src}
          src={src}
          alt={`${alt} — ${i + 1}/${images.length}`}
          aria-hidden={i !== index}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out ${
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          } ${fit === "contain" ? "object-contain" : "object-cover"}`}
          style={{ objectPosition: position }}
        />
      ))}

      <button
        type="button"
        onClick={() => goTo(index - 1)}
        aria-label={t("prevAria")}
        className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 sm:left-5 sm:h-11 sm:w-11"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 sm:h-6 sm:w-6">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label={t("nextAria")}
        className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-5 sm:h-11 sm:w-11"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 sm:h-6 sm:w-6">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
