import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContentBlockView } from "@/components/content-block-view";
import { EducationHighlights } from "@/components/education-highlights";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("educationPage");
  return { title: t("metaTitle") };
}

export default async function EducationDirectionPage() {
  const t = await getTranslations("educationPage");
  const tCommon = await getTranslations("common");
  const tWhyUs = await getTranslations("whyUs");

  return (
    <ContentBlockView
      blockKey="talim-yonalishi"
      eyebrow={tCommon("pagesEyebrow")}
      fallbackTitle={t("fallbackTitle")}
      fallbackBody={tWhyUs("features.education")}
      heroImage={{ src: "/rasm/yonalishlar.png", alt: t("heroImageAlt"), position: "50% 0%" }}
      afterContent={<EducationHighlights />}
    />
  );
}
