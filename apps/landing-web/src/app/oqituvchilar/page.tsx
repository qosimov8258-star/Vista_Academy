import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { TeacherSubjectHighlights } from "@/components/teacher-subject-highlights";
import { TeacherGrid } from "@/components/teacher-grid";
import { fetchLanding } from "@/lib/api";
import { cdn } from "@/lib/cdn";
import type { LandingTeacher } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teachersPage");
  return { title: t("metaTitle") };
}

/**
 * CMS'da hali o'qituvchi kiritilmagan bo'lsa ham sahifa bo'sh ko'rinmasin
 * deb, chinakam ma'lumot ustiga tushguncha shu namunaviy jamoa ko'rsatiladi.
 */
async function getPlaceholderTeachers(): Promise<LandingTeacher[]> {
  const t = await getTranslations("teachersPage.placeholders");
  return [
    {
      id: "placeholder-1",
      fullName: "Dilnoza Qosimova",
      role: t("teacher1.role"),
      bio: t("teacher1.bio"),
      experience: t("teacher1.experience"),
      photoPath: null,
    },
    {
      id: "placeholder-2",
      fullName: "Malika Yusupova",
      role: t("teacher2.role"),
      bio: t("teacher2.bio"),
      experience: t("teacher2.experience"),
      photoPath: null,
    },
    {
      id: "placeholder-3",
      fullName: "Nodira Karimova",
      role: t("teacher3.role"),
      bio: t("teacher3.bio"),
      experience: t("teacher3.experience"),
      photoPath: null,
    },
    {
      id: "placeholder-4",
      fullName: "Sevara Rashidova",
      role: t("teacher4.role"),
      bio: t("teacher4.bio"),
      experience: t("teacher4.experience"),
      photoPath: null,
    },
  ];
}

export default async function TeachersPage() {
  const fetched = await fetchLanding<LandingTeacher[]>("/teachers", []);
  const teachers = fetched.length > 0 ? fetched : await getPlaceholderTeachers();
  const t = await getTranslations("teachersPage");
  const tCommon = await getTranslations("common");
  const tGroups = await getTranslations("groups");

  return (
    <PageShell
      eyebrow={tCommon("pagesEyebrow")}
      title={tGroups("teachers")}
      description={t("description")}
      heroImage={{ src: cdn("/rasm/oqtuvchi.jpeg"), alt: t("heroImageAlt"), position: "50% 90%" }}
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
