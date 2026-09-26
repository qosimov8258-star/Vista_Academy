import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { TeacherSubjectHighlights } from "@/components/teacher-subject-highlights";
import { TeacherGrid } from "@/components/teacher-grid";
import { fetchLanding } from "@/lib/api";
import type { LandingTeacher } from "@/lib/types";

export const metadata: Metadata = {
  title: "O'qituvchilar — Vista Academy",
};

/**
 * CMS'da hali o'qituvchi kiritilmagan bo'lsa ham sahifa bo'sh ko'rinmasin
 * deb, chinakam ma'lumot ustiga tushguncha shu namunaviy jamoa ko'rsatiladi.
 */
const PLACEHOLDER_TEACHERS: LandingTeacher[] = [
  {
    id: "placeholder-1",
    fullName: "Dilnoza Qosimova",
    role: "Bosh tarbiyachi",
    bio: "Har bir bola menga o'z farzandimdek aziz.",
    experience: "Maktabgacha ta'lim yo'nalishida 12 yillik tajribaga ega, bir necha filial jamoasini boshqargan.",
    photoPath: null,
  },
  {
    id: "placeholder-2",
    fullName: "Malika Yusupova",
    role: "Ingliz tili o'qituvchisi",
    bio: "Bolalar bilan o'ynab o'rganish eng samarali usul.",
    experience: "Ingliz tili bo'yicha 6 yillik tajriba, xalqaro IELTS sertifikatiga ega.",
    photoPath: null,
  },
  {
    id: "placeholder-3",
    fullName: "Nodira Karimova",
    role: "Mental arifmetika o'qituvchisi",
    bio: "Mental arifmetika bolaning tafakkurini rivojlantiradi.",
    experience: "Mental arifmetika yo'nalishida 5 yillik tajriba, respublika miqyosidagi bolalar musobaqalarida shogirdlarini tayyorlagan.",
    photoPath: null,
  },
  {
    id: "placeholder-4",
    fullName: "Sevara Rashidova",
    role: "Kichik guruh tarbiyachisi",
    bio: "Sabr va mehr — ishimning asosi.",
    experience: "Kichik yoshdagi bolalar bilan ishlashda 8 yillik tajribaga ega, bolalar psixologiyasi bo'yicha qo'shimcha ta'lim olgan.",
    photoPath: null,
  },
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
        <TeacherGrid teachers={teachers} />
      </div>
    </PageShell>
  );
}
