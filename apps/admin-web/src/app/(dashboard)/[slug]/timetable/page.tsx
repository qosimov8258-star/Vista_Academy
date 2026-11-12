"use client";

import { use } from "react";
import { TimetablePage } from "@/features/timetable/timetable-page";

/** Haftalik jadval — guruhlarning kun tartibi (ota-onalar kabinetida ham ko'rinadi) */
export default function WeeklyTimetablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <TimetablePage slug={slug} />;
}
