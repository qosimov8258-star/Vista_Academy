"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Butun sahifani qoplaydigan yuklanish ekrani.
 *
 * QAYERDA CHAQIRISH KERAK:
 * Bu komponent ENG TEPADA — root layout ichida, boshqa hamma narsadan oldin
 * chaqirilishi kerak, chunki u ilova hali render bo'lmasdan turib (masalan,
 * shrift/asosiy CSS yuklanayotganda yoki keyinchalik global "ilova tayyor
 * emas" holatlarida) ko'rsatiladigan eng birinchi UI qatlami hisoblanadi.
 *
 * Next.js (App Router) misoli — src/app/layout.tsx:
 *
 *   import { LoadingScreen } from "@/components/LoadingScreen";
 *
 *   export default function RootLayout({ children }: { children: React.ReactNode }) {
 *     return (
 *       <html lang="uz">
 *         <body>
 *           <LoadingScreen />
 *           <QueryProvider>{children}</QueryProvider>
 *         </body>
 *       </html>
 *     );
 *   }
 *
 * Oddiy React (Vite/CRA) misoli — App.tsx:
 *
 *   function App() {
 *     return (
 *       <>
 *         <LoadingScreen />
 *         <Router>...</Router>
 *       </>
 *     );
 *   }
 *
 * Izoh: bu komponent `fixed inset-0` bilan butun ekranni qoplaydi va faqat
 * `visible` prop true bo'lganda ko'rinadi (default: true). `visible` false
 * bo'lganda darhol yo'qolmaydi — avval silliq fade-out (`FADE_DURATION_MS`)
 * bilan xiralashadi, so'ng DOM'dan olib tashlanadi.
 *
 * `minDurationMs` — `visible` orqali boshqariladigan (controlled) holatda,
 * ekran kamida shuncha millisekund ko'rinishini kafolatlaydi: `visible`
 * true bo'lgan paytdan hisoblanadi va parent shu vaqt to'lmasdan turib
 * `visible={false}` qilsa ham, ekran vaqt to'lgunicha (va shundan keyingina
 * fade-out bilan) yopilmaydi. Komponent shunchaki hech qanday `visible`
 * o'zgarishisiz JSX'dan olib tashlanadigan holatlarga ta'sir qilmaydi.
 *
 * Real foydalanish misoli uchun: sign-in muvaffaqiyatli bo'lganda
 * ko'rsatib, dashboard'ning boshlang'ich ma'lumotlari tayyor bo'lgach
 * yashiradigan oqim src/lib/post-login-loading.tsx faylida joylashgan.
 */
const FADE_DURATION_MS = 300;

export function LoadingScreen({
  visible = true,
  minDurationMs = 0,
}: {
  visible?: boolean;
  minDurationMs?: number;
}) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const shownAtRef = useRef<number | null>(visible ? Date.now() : null);

  // `visible` false bo'lganda, kamida `minDurationMs` o'tgach fade-out'ni boshlaydi.
  useEffect(() => {
    if (visible) {
      shownAtRef.current = Date.now();
      setShouldRender(true);
      setIsFadingOut(false);
      return;
    }

    if (!shouldRender) return;

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : minDurationMs;
    const remaining = Math.max(0, minDurationMs - elapsed);

    if (remaining === 0) {
      setIsFadingOut(true);
      return;
    }

    const minDurationTimeout = setTimeout(() => setIsFadingOut(true), remaining);
    return () => clearTimeout(minDurationTimeout);
  }, [visible, shouldRender, minDurationMs]);

  // Fade-out animatsiyasi tugagach, komponentni DOM'dan olib tashlaydi.
  useEffect(() => {
    if (!isFadingOut) return;
    const fadeTimeout = setTimeout(() => setShouldRender(false), FADE_DURATION_MS);
    return () => clearTimeout(fadeTimeout);
  }, [isFadingOut]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-[var(--color-bg)] transition-opacity duration-300 ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-4 text-[clamp(48px,9vw,96px)]">
        <span
          className="font-bold leading-none tracking-[25px] text-[var(--color-primary)]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          NYX
        </span>
        <img
          src="/ring_380x380.png"
          alt="Bog'chalar tarmog'i"
          className="animate-nyx-logo-spin h-[1em] w-auto shrink-0"
        />
        <span className="flex items-center gap-[0.22em] self-end" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-[0.16em] w-[0.16em] animate-nyx-dot-blink rounded-full bg-[var(--color-primary)]"
              style={{ animationDelay: `${dot * 200}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
