import type { Metadata } from "next";
import { ContentBlockView } from "@/components/content-block-view";
import { CaregiverHighlights } from "@/components/caregiver-highlights";

export const metadata: Metadata = {
  title: "Doimiy tarbiyachi — Vista Academy",
};

export default function PermanentCaregiverPage() {
  return (
    <ContentBlockView
      blockKey="doimiy-tarbiyachi"
      eyebrow="Guruhlarimiz"
      fallbackTitle="Doimiy tarbiyachi"
      fallbackBody="Bolalar keyingi guruhga o'tguncha bir xil tarbiyachi bilan qoladi — bu ishonch va barqarorlik yaratadi."
      heroImage={{ src: "/rasm/tarbiyachi.png", alt: "Tarbiyachi bolalar bilan mashg'ulot o'tkazmoqda", position: "50% 0%" }}
      afterContent={<CaregiverHighlights />}
    />
  );
}
