import Image from "next/image";

export function MealsIntro() {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
          Har bir tovoqda g&apos;amxo&apos;rlik
        </p>
        <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
          Farzandingiz nimani yeyotganini biling — biz uni o&apos;z farzandimizdek his qilamiz
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
          Bolalik davri — tanamiz umrbod eslab qoladigan davr. Shuning uchun oshxonamizda har bir
          taom yangi mahsulotlardan, konservantsiz va ortiqcha shakarsiz tayyorlanadi. Haftalik
          menyu tarbiyachi va dietolog nazorati ostida tuziladi — nonushtadan kechki ovqatgacha
          bola o&apos;sishi uchun zarur vitamin va energiyani to&apos;liq oladi.
        </p>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">
          Natija — quvnoq, faol va sog&apos;lom bola, ota-onalar esa xotirjam: farzandi doim
          to&apos;yingan va to&apos;g&apos;ri ovqatlanadi.
        </p>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-raised)]">
        <Image
          src="/taom/bolalar3.jpg"
          alt="Bolalar bog'chada sog'lom taom yemoqda"
          width={600}
          height={400}
          sizes="(min-width: 1024px) 520px, 100vw"
          className="h-auto w-full object-cover"
        />
      </div>
    </div>
  );
}
