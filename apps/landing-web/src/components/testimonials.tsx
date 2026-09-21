import Image from "next/image";

const REVIEWS = [
  {
    name: "Dilnoza Ergasheva",
    role: "4 yoshli qizning onasi",
    text: "Farzandim bog'chaga borishni juda yaxshi ko'rib qoldi, har kuni quvnoq qaytadi uydan.",
  },
  {
    name: "Bekzod Qodirov",
    role: "3 yoshli o'g'ilning otasi",
    text: "Tarbiyachilar juda mehribon va e'tiborli, har bir bolaga alohida yondashadi.",
  },
  {
    name: "Nilufar Saidova",
    role: "2 yoshli qizning onasi",
    text: "Ovqatlanish va gigiyena juda toza tashkil qilingan, hech qanday xavotirim yo'q.",
  },
  {
    name: "Jasur Toshpulatov",
    role: "5 yoshli o'g'ilning otasi",
    text: "Ingliz tili va rivojlanish darslari bolamning nutqiga juda katta ijobiy ta'sir ko'rsatdi.",
  },
  {
    name: "Madina Rahimova",
    role: "4 yoshli qizning onasi",
    text: "Har hafta hisobot va suratlar yuborishadi — farzandim bilan doim aloqada his qilaman.",
  },
];

function ReviewCard({ review }: { review: (typeof REVIEWS)[number] }) {
  return (
    <div className="w-[300px] shrink-0 rounded-[var(--radius-lg)] bg-white px-6 py-6 text-left shadow-[var(--shadow-card)]">
      <p className="text-[15px] leading-relaxed text-[var(--color-text)]">&ldquo;{review.text}&rdquo;</p>
      <p className="font-heading mt-4 text-[14px] font-bold text-[var(--color-text)]">{review.name}</p>
      <p className="text-[13px] text-[var(--color-text-muted)]">{review.role}</p>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-[560px] px-4 text-center">
        <div className="relative mx-auto h-[180px] w-full max-w-[560px] sm:h-[220px]">
          <Image src="/bezak/bezak.jpg" alt="O'ynayotgan bolalar" fill sizes="560px" className="object-contain" />
        </div>

        <p className="mt-6 text-[16px] italic leading-relaxed text-[var(--color-text-muted)]">
          Har bir bola — o&apos;zgacha rang, o&apos;zgacha kulgu.
          <br />
          Bizning bog&apos;chamizda hammasi birga o&apos;ynab, birga ulg&apos;ayadi.
        </p>
      </div>

      <div className="marqueeWrap mx-auto mt-10 max-w-[1120px]">
        <div className="marqueeTrack">
          {REVIEWS.map((review) => (
            <ReviewCard key={`a-${review.name}`} review={review} />
          ))}
          {REVIEWS.map((review) => (
            <ReviewCard key={`b-${review.name}`} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}
