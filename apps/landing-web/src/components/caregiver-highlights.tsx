import Image from "next/image";

export function CaregiverHighlights() {
  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-4 sm:gap-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              Bir xil yuz, bir xil mehr
            </p>
            <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
              Tarbiyachi bola bilan birga o&apos;sadi
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Guruh keyingi bosqichga o&apos;tganda ham, farzandingiz yoniga hamon tanish va
              yaqin tarbiyachi qoladi. Bu doimiylik bola uchun har kuni yangi odamlarga
              o&apos;rganib olish stressini yo&apos;qotadi va uni o&apos;ziga ishonchli qiladi.
            </p>
          </div>

          <div className="order-1 overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2">
            <Image
              src="/tarbiyachi/tarbiyachi2.jpg"
              alt="Tarbiyachi bolalar bilan mashg'ulot o'tkazmoqda"
              width={612}
              height={408}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
            <Image
              src="/tarbiyachi/tarbiyachi3.jpg"
              alt="Tarbiyachi har bir bolaga alohida e'tibor bermoqda"
              width={612}
              height={408}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>

          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
              Har bir bolani chuqur bilish
            </p>
            <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
              Xarakter va ehtiyojlarga alohida yondashuv
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Doimiy tarbiyachi farzandingizning odatlarini, kayfiyatini va qiziqishlarini
              vaqt o&apos;tishi bilan chuqur o&apos;rganadi. Shu bilim asosida har bir bolaga
              individual yondashadi va uning rivojlanishini izchil kuzatib boradi.
            </p>
          </div>
        </div>

        <div>
          <div className="mx-auto max-w-[600px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
            <Image
              src="/tarbiyachi/tarbiyachi1.jpg"
              alt="Tarbiyachi bolalar bilan mehr-oqibat bilan mashg'ul bo'lmoqda"
              width={612}
              height={472}
              sizes="(min-width: 640px) 600px, 90vw"
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="mx-auto mt-8 max-w-[640px] text-center">
            <p className="font-heading text-[22px] font-bold leading-snug tracking-tight text-[var(--color-text)] sm:text-[26px]">
              Bog&apos;chamizda har bir kun mehr, sabr va g&apos;amxo&apos;rlik bilan boshlanadi.
              <br />
              Tarbiyachilarimiz farzandingiz uchun ikkinchi ona kabi yonida bo&apos;ladi.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
