import Image from "next/image";

export function Adaptation() {
  return (
    <section id="moslashish" className="py-20 sm:py-28" style={{ background: "var(--color-surface)" }}>
      <div className="mx-auto max-w-[1120px] px-4">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
            <Image
              src="/rasm/moslashuvchan-bolalar.png"
              alt="Bolalar bog'cha guruhida birga o'ynab, do'stlashib ketishmoqda"
              width={632}
              height={422}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>

          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
              Moslashuv davri
            </p>
            <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
              Bog&apos;chaga moslashish — birga, sekin-asta
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Har bir bola uchun bog&apos;chadagi birinchi kunlar — yangi va hayajonli bosqich.
              Shuning uchun biz shoshilmaymiz: dastlab farzandingiz siz bilan birga tanishadi,
              so&apos;ng qisqa vaqtga guruhda qoladi, so&apos;ngra esa kun bo&apos;yi tengdoshlari
              bilan o&apos;ynab, o&apos;rganib ulguradi. Tajribali tarbiyachilarimiz har bir
              bolaning kayfiyati va xarakteriga alohida e&apos;tibor qaratadi — shunda ajralish
              qo&apos;rquvi o&apos;rnini ishonch va quvonch egallaydi. Natijada farzandingiz
              bog&apos;chaga yig&apos;lab emas, kulib boradi va u yerda umrbod eslab qoladigan
              do&apos;stlar topadi.
            </p>
          </div>
        </div>

        <div className="my-20 flex flex-col items-center text-center sm:my-24">
          <div className="w-full max-w-[360px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
            <Image
              src="/moslashish/love.jpg"
              alt="Bolalar qo'l ushlashib, yurak shaklida do'stlik va sevgi ramzini yasashmoqda"
              width={612}
              height={534}
              sizes="(min-width: 1024px) 360px, 60vw"
              className="h-auto w-full object-cover"
            />
          </div>
          <p className="mt-6 max-w-[520px] text-[17px] font-medium leading-relaxed text-[var(--color-text)]">
            Har bir bola — bitta katta oilaning bir bo&apos;lagi.
            <br />
            Bog&apos;chamizda ular sevgi bilan birlashib, chin do&apos;stlikni his etishadi.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
              Har bir qadam nazoratda
            </p>
            <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
              Moslashish jarayoni — tajribali tarbiyachilar bilan
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
              Moslashish davrida tarbiyachilarimiz farzandingiz bilan doimiy muloqotda bo&apos;lib,
              uning holatini kuzatib boradi. Har bir bosqich ota-onalar bilan kelishilgan holda
              amalga oshiriladi — shu tufayli bola ham, ota-ona ham bog&apos;cha muhitiga xotirjam
              va ishonch bilan ko&apos;nikadi.
            </p>
          </div>

          <div className="order-1 overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)] lg:order-2">
            <Image
              src="/moslashish/moslash1.jpg"
              alt="Bolalar bog'chaga moslashish jarayonida tarbiyachi bilan"
              width={612}
              height={323}
              sizes="(min-width: 1024px) 520px, 100vw"
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
