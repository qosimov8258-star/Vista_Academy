import type { Metadata } from "next";
import Image from "next/image";
import { PageShell } from "@/components/page-shell";
import { TeacherSubjectHighlights } from "@/components/teacher-subject-highlights";
import { fetchLanding, assetUrl } from "@/lib/api";
import type { LandingTeacher } from "@/lib/types";

export const metadata: Metadata = {
  title: "O'qituvchilar — Vista Academy",
};

/**
 * CMS'da hali o'qituvchi kiritilmagan bo'lsa ham sahifa bo'sh ko'rinmasin
 * deb, chinakam ma'lumot ustiga tushguncha shu namunaviy jamoa ko'rsatiladi.
 */
const PLACEHOLDER_TEACHERS: LandingTeacher[] = [
  { id: "placeholder-1", fullName: "Dilnoza Qosimova", role: "Bosh tarbiyachi", bio: "Har bir bola menga o'z farzandimdek aziz.", photoPath: null },
  { id: "placeholder-2", fullName: "Malika Yusupova", role: "Ingliz tili o'qituvchisi", bio: "Bolalar bilan o'ynab o'rganish eng samarali usul.", photoPath: null },
  { id: "placeholder-3", fullName: "Nodira Karimova", role: "Mental arifmetika o'qituvchisi", bio: "Mental arifmetika bolaning tafakkurini rivojlantiradi.", photoPath: null },
  { id: "placeholder-4", fullName: "Sevara Rashidova", role: "Kichik guruh tarbiyachisi", bio: "Sabr va mehr — ishimning asosi.", photoPath: null },
];

export default async function TeachersPage() {
  const fetched = await fetchLanding<LandingTeacher[]>("/teachers", []);
  const teachers = fetched.length > 0 ? fetched : PLACEHOLDER_TEACHERS;

  return (
    <PageShell
      eyebrow="Guruhlarimiz"
      title="O'qituvchilar"
      description="Farzandingiz bilan har kuni birga bo'ladigan mehribon va tajribali jamoamiz."
      heroImage={{ src: "/rasm/oqtuvchi.png", alt: "O'qituvchi bolalarga darsda yordam bermoqda", position: "50% 0%" }}
      afterContent={<TeacherSubjectHighlights />}
    >
      <div
        className="mx-auto max-w-[1120px] rounded-[var(--radius-xl)] px-4 py-10 sm:px-8 sm:py-12"
        style={{ background: "var(--color-tint-green)" }}
      >
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="text-center">
              <div
                className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-card)]"
                style={{ background: "var(--color-tint)" }}
              >
                {teacher.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                  <img src={assetUrl(teacher.photoPath) ?? undefined} alt={teacher.fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Image
                      src="/icon/teacher.png"
                      alt=""
                      width={96}
                      height={96}
                      className="h-auto w-[45%] max-w-[100px] opacity-80"
                    />
                  </div>
                )}
              </div>
              <p className="font-heading mt-4 text-[17px] font-bold text-[var(--color-text)]">{teacher.fullName}</p>
              <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--color-green)" }}>
                {teacher.role}
              </p>
              {teacher.bio && (
                <p className="mx-auto mt-2 max-w-[200px] text-[13.5px] italic leading-relaxed text-[var(--color-text-muted)]">
                  &ldquo;{teacher.bio}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
