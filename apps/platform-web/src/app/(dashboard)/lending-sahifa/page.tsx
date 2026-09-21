"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { ScheduleTab } from "@/features/landing/schedule-tab";
import { MealsTab } from "@/features/landing/meals-tab";
import { TeachersTab } from "@/features/landing/teachers-tab";
import { ContentBlocksTab } from "@/features/landing/content-blocks-tab";

type Tab = "schedule" | "meals" | "teachers" | "content";

const TABS: { value: Tab; label: string }[] = [
  { value: "schedule", label: "Jadval" },
  { value: "meals", label: "Taomlar" },
  { value: "teachers", label: "O'qituvchilar" },
  { value: "content", label: "Kontent" },
];

export default function LendingSahifaPage() {
  const [tab, setTab] = useState<Tab>("schedule");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lending sahifa"
        description={'landing-web saytidagi "Guruhlarimiz" menyusi ostidagi kontentni shu yerdan boshqaring'}
      />

      <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Lending sahifa bo'limlari" />

      {tab === "schedule" && <ScheduleTab />}
      {tab === "meals" && <MealsTab />}
      {tab === "teachers" && <TeachersTab />}
      {tab === "content" && <ContentBlocksTab />}
    </div>
  );
}
