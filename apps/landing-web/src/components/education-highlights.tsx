import Image from "next/image";
import { Reveal } from "./reveal";

export function EducationHighlights() {
  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-4 sm:gap-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal direction="left" className="overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
            <Image
              src="/talim/talim.jpeg"
              alt="Bolalar harflar va raqamlar bilan o'yin orqali tanishmoqda"
              width={600}
              height={338}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full object-cover"
            />
          </Reveal>

          <Reveal direction="right" delay={120} className="text-center lg:text-left">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              O&apos;yin orqali o&apos;rganish
            </p>
            <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
              Harflar, raqamlar va shakllar bilan tanishuv
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Har bir mashg&apos;ulot bolalar uchun qiziqarli o&apos;yin shaklida quriladi — flesh-kartalar,
              rang-barang materiallar va guruh bo&apos;lib bajariladigan topshiriqlar orqali bolalar
              harflar, raqamlar va shakllarni tabiiy ravishda eslab qolishadi. Bu yondashuv diqqatni
              jamlash, mustaqil fikrlash va tengdoshlar bilan hamkorlik qilish ko&apos;nikmalarini ham
              rivojlantiradi — maktabga puxta tayyorgarlikning muhim qadami.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal direction="left" className="order-2 text-center lg:order-1 lg:text-left">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
              Kitobxonlik soati
            </p>
            <h2 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
              Nutq va tafakkurni rivojlantirish
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Tarbiyachilarimiz har kuni bolalarga ovoz chiqarib kitob o&apos;qib beradi — rang-barang
              rasmli kitoblar orqali bolalar yangi so&apos;zlarni o&apos;rganadi, savol berishni va
              o&apos;z fikrini bayon qilishni o&apos;rganadi. Muntazam kitobxonlik lug&apos;at boyligini
              oshiradi, tasavvurni kengaytiradi va bolada kitobga bo&apos;lgan qiziqishni yoshligidan
              shakllantiradi.
            </p>
          </Reveal>

          <Reveal
            direction="right"
            delay={120}
            className="order-1 overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2"
          >
            <Image
              src="/talim/talim2.jpg"
              alt="Tarbiyachi bolalarga rasmli kitob o'qib bermoqda"
              width={600}
              height={400}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full object-cover"
            />
          </Reveal>
        </div>

        <div>
          <Reveal direction="up" className="mx-auto max-w-[600px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
            <Image
              src="/talim/talim4.jpg"
              alt="Tarbiyachi globus va kitoblar yordamida bolalarga dunyo haqida hikoya qilib bermoqda"
              width={600}
              height={400}
              sizes="(min-width: 640px) 600px, 90vw"
              className="h-auto w-full object-cover"
            />
          </Reveal>

          <Reveal direction="up" delay={150} className="mx-auto mt-8 max-w-[640px] text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              Dunyoni kashf etish
            </p>
            <p className="font-heading mt-3 text-[22px] font-bold leading-snug tracking-tight text-[var(--color-text)] sm:text-[26px]">
              Bugun ertak tinglagan bola — ertaga dunyoni o&apos;ziga xos nigoh bilan ko&apos;radi.
              Har bir hikoya bolamiz uchun yangi bir kashfiyot sari eshikdir.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
