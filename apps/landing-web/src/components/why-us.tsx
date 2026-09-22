import Image from "next/image";

const FEATURES = [
  {
    icon: "/icon/clock.png",
    title: "Moslashuvchan jadval",
    description: "Ertalab 7:00 dan kechqurun 19:00 gacha ochiq — ota-onalar ish bilan bog'chani muvozanatlashtirishi oson.",
    href: "/jadval",
  },
  {
    icon: "/icon/food.png",
    title: "Sog'lom taomlar",
    description: "Kun davomida muvozanatli va sifatli ovqatlanish — dastur doirasida qo'shimcha to'lovsiz taqdim etiladi.",
    href: "/taomlar",
  },
  {
    icon: "/icon/teacher.png",
    title: "Doimiy tarbiyachi",
    description: "Bolalar keyingi guruhga o'tguncha bir xil tarbiyachi bilan qoladi — bu ishonch va barqarorlik yaratadi.",
    href: "/tarbiyachi",
  },
  {
    icon: "/icon/book.png",
    title: "Ta'lim yo'nalishi",
    description: "Zamonaviy dastur asosida yoshiga mos faoliyatlar bilan bolani maktabga tayyorlaymiz.",
    href: "/talim-yonalishi",
  },
];

export function WhyUs() {
  return (
    <section id="about" className="py-20 sm:py-28" style={{ background: "var(--color-tint)" }}>
      <div className="mx-auto max-w-[720px] px-4 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
          Biz haqimizda
        </p>
        <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
          Vista Academy&apos;ni nima o&apos;ziga xos qiladi?
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
          Biz farzandingiz muvaffaqiyatiga bag&apos;ishlangan mehribon jamoamiz. Xavfsizlik, mehr,
          ilhom va ta&apos;lim qadriyatlariga asoslanib, har bir bolaga eng yaxshi boshlanishni beramiz.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-[1120px] grid-cols-1 gap-5 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <a
            key={feature.title}
            href={feature.href}
            className="rounded-[var(--radius-xl)] bg-white p-6 shadow-[var(--shadow-card)] transition-transform duration-150 hover:-translate-y-1"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-tint)]" aria-hidden="true">
              <Image src={feature.icon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            </span>
            <p className="font-heading mt-4 text-[17px] font-bold text-[var(--color-text)]">{feature.title}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">{feature.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
