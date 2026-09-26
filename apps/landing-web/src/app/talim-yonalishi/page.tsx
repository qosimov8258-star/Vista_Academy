import type { Metadata } from "next";
import { ContentBlockView } from "@/components/content-block-view";
import { EducationHighlights } from "@/components/education-highlights";

export const metadata: Metadata = {
  title: "Ta'lim yo'nalishi — Vista Academy",
};

export default function EducationDirectionPage() {
  return (
    <ContentBlockView
      blockKey="talim-yonalishi"
      eyebrow="Guruhlarimiz"
      fallbackTitle="Ta'lim yo'nalishi va kelajak"
      fallbackBody="Zamonaviy dastur asosida yoshiga mos faoliyatlar bilan bolani maktabga tayyorlaymiz."
      heroImage={{ src: "/rasm/yonalishlar.png", alt: "O'quvchilar darsda qo'l ko'tarib javob bermoqda", position: "50% 0%" }}
      afterContent={<EducationHighlights />}
    />
  );
}
