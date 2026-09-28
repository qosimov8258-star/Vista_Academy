import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContentBlockView } from "@/components/content-block-view";
import { CaregiverHighlights } from "@/components/caregiver-highlights";
import { cdn } from "@/lib/cdn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("caregiverPage");
  return { title: t("metaTitle") };
}

export default async function PermanentCaregiverPage() {
  const t = await getTranslations("caregiverPage");
  const tCommon = await getTranslations("common");
  const tWhyUs = await getTranslations("whyUs");

  return (
    <ContentBlockView
      blockKey="doimiy-tarbiyachi"
      eyebrow={tCommon("pagesEyebrow")}
      fallbackTitle={t("fallbackTitle")}
      fallbackBody={tWhyUs("features.teacher")}
      heroImage={{ src: cdn("/rasm/tarbiyachi.jpeg"), alt: t("heroImageAlt"), position: "50% 0%" }}
      afterContent={<CaregiverHighlights />}
    />
  );
}
