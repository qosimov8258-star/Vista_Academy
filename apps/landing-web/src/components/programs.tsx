import Image from "next/image";

const GROUPS = [
  {
    image: "/icon/baby1.jpg",
    title: "Chaqaloqlar",
    age: "2 oydan 1 yoshgacha",
    color: "#ef8a63",
    arch: { topLeft: "99px", topRight: "999px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/bolalar.jpg",
    title: "Kichkintoylar",
    age: "1 dan 3 yoshgacha",
    color: "#aead45",
    arch: { topLeft: "999px", topRight: "999px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/orta-guruh.jpg",
    title: "O'rta guruh",
    age: "3 dan 4 yoshgacha",
    color: "#cf5599",
    arch: { topLeft: "999px", topRight: "99px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/katta-guruh.jpg",
    title: "Katta guruh",
    age: "4 dan 6 yoshgacha",
    color: "var(--color-green)",
    arch: { topLeft: "99px", topRight: "999px", bottomLeft: "20px", bottomRight: "20px" },
  },
  {
    image: "/icon/maktab.jpg",
    title: "Maktab yoshidagilar",
    age: "6 dan 12 yoshgacha",
    color: "var(--color-blue)",
    arch: { topLeft: "999px", topRight: "99px", bottomLeft: "20px", bottomRight: "20px" },
  },
];

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 14 14 6M8 6h6v6" />
    </svg>
  );
}

function GroupCard({ group }: { group: (typeof GROUPS)[number] }) {
  return (
    <div className="w-full max-w-[240px] rounded-[32px] p-3" style={{ background: group.color }}>
      <div
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden"
        style={{
          borderTopLeftRadius: group.arch.topLeft,
          borderTopRightRadius: group.arch.topRight,
          borderBottomLeftRadius: group.arch.bottomLeft,
          borderBottomRightRadius: group.arch.bottomRight,
        }}
      >
        <Image
          src={group.image}
          alt={`${group.title} guruhi`}
          fill
          sizes="(min-width: 1024px) 240px, 45vw"
          className="object-cover"
        />
      </div>
      <div className="relative z-10 mx-1 -mt-6 rounded-2xl bg-white px-4 py-3 text-center shadow-[var(--shadow-card)]">
        <p className="font-heading text-[16px] font-bold leading-tight text-[var(--color-text)]">{group.title}</p>
        <p className="mt-0.5 text-[13px] italic text-[var(--color-text-muted)]">{group.age}</p>
      </div>
    </div>
  );
}

export function Programs() {
  const [firstRow, secondRow] = [GROUPS.slice(0, 3), GROUPS.slice(3)];

  return (
    <section id="classrooms" className="py-20 sm:py-28">
      <div className="mx-auto max-w-[720px] px-4 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-green)" }}>
          Guruhlarimiz
        </p>
        <h2 className="font-heading mt-3 text-[30px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[36px]">
          Har bir yosh bosqichi uchun mos guruh
        </h2>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1120px] flex-wrap justify-center gap-5 px-4">
        {firstRow.map((group) => (
          <GroupCard key={group.title} group={group} />
        ))}
      </div>
      <div className="mx-auto mt-5 flex max-w-[560px] flex-wrap justify-center gap-5 px-4">
        {secondRow.map((group) => (
          <GroupCard key={group.title} group={group} />
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-[560px] px-4 text-center">
        <p className="text-[16px] italic leading-relaxed text-[var(--color-text-muted)]">
          Shunchaki bog&apos;cha emas — bolalar o&apos;sadigan, o&apos;rganadigan va kashf qiladigan makon.
        </p>
        <a
          href="#apply"
          className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-bold"
          style={{ color: "var(--color-yellow-dark)" }}
        >
          Batafsil ma&apos;lumot
          <ArrowUpRightIcon className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
