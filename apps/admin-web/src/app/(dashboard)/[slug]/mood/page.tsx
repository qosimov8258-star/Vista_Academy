"use client";

import { use } from "react";
import { TeacherMood } from "@/features/teacher/teacher-mood";

/** Kayfiyat belgilash — tarbiyachi bosh sahifasidagi «Kayfiyat» yorlig'idan ochiladi */
export default function MoodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <TeacherMood slug={slug} />;
}
