import Image from "next/image";

/**
 * Ushbu ikki fanning o'ziga xos o'qituvchisi hali suratga tushmagan —
 * shuning uchun rasm o'rnida mavzuga mos icon ko'rsatiladi. Chin surat
 * qo'shilganda shu joyga <Image src="..." /> qo'yiladi.
 */
function AbacusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <rect x="8" y="10" width="80" height="76" rx="12" fill="none" stroke="#a8794f" strokeWidth="5" />
      <line x1="16" y1="30" x2="80" y2="30" stroke="#a8794f" strokeWidth="3" />
      <line x1="16" y1="48" x2="80" y2="48" stroke="#a8794f" strokeWidth="3" />
      <line x1="16" y1="66" x2="80" y2="66" stroke="#a8794f" strokeWidth="3" />
      <circle cx="30" cy="30" r="7" fill="var(--color-blue)" />
      <circle cx="48" cy="30" r="7" fill="var(--color-blue)" />
      <circle cx="66" cy="30" r="7" fill="var(--color-blue)" />
      <circle cx="24" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="42" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="60" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="78" cy="48" r="7" fill="var(--color-green)" />
      <circle cx="36" cy="66" r="7" fill="var(--color-yellow)" />
      <circle cx="54" cy="66" r="7" fill="var(--color-yellow)" />
      <circle cx="72" cy="66" r="7" fill="var(--color-yellow)" />
    </svg>
  );
}

function PlaceholderFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-full shadow-[var(--shadow-raised)]"
      style={{ background: "var(--color-tint)" }}
    >
      {children}
    </div>
  );
}

export function TeacherSubjectHighlights() {
  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-4 sm:gap-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              Erta yoshdan til o&apos;rganish
            </p>
            <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
              Ingliz tili o&apos;qituvchisi
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Ingliz tili o&apos;qituvchimiz bolalarga tilni yodlash orqali emas, qo&apos;shiq, she&apos;r va
              rolli o&apos;yinlar orqali singdiradi. Har bir dars quvnoq muhitda o&apos;tadi — bolalar yangi
              so&apos;zlarni to&apos;g&apos;ri talaffuz bilan, qo&apos;rquvsiz gapirishni o&apos;rganadi. Bu
              yondashuv keyinchalik maktabda til o&apos;rganishni ancha osonlashtiradi.
            </p>
          </div>

          <div className="order-1 lg:order-2">
            <PlaceholderFrame>
              <Image src="/icon/book.png" alt="" width={120} height={120} className="h-auto w-[32%] max-w-[130px] opacity-90" />
            </PlaceholderFrame>
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <PlaceholderFrame>
              <AbacusIcon className="h-auto w-[34%] max-w-[130px] opacity-90" />
            </PlaceholderFrame>
          </div>

          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
              Tez fikrlash va diqqat
            </p>
            <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
              Mental arifmetika o&apos;qituvchisi
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Mental arifmetika o&apos;qituvchimiz bolalarga avval abakus (hisoblash taxtachasi) yordamida
              sonlar bilan ishlashni, so&apos;ng ularni faqat tasavvur orqali hisoblashga o&apos;rgatadi. Bu
              mashg&apos;ulotlar diqqatni jamlash, xotira va tez fikrlash qobiliyatini rivojlantiradi — bola
              nafaqat matematikada, balki boshqa fanlarda ham yutuqqa erishadi.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
