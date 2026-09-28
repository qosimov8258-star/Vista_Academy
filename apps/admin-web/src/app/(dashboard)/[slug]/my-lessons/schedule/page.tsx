"use client";

// O'qituvchi kabinetining o'z manzili — filial adminining `/lessons/schedule`
// sahifasi bilan bir xil URL bo'lmasin (aks holda ikkalasi xuddi bitta joy
// bo'lib chalkashtirib yuboradi). Tarbiyachi telefon uchun qilingan iOS
// jadvalini ko'radi; boshqa rol bu manzilga tushib qolsa — umumiy sahifa.
import { use } from "react";
import { useAuth } from "@/lib/use-auth";
import { isTeacher } from "@/lib/permissions";
import { LoadingState } from "@/components/ui/states";
import { TeacherSchedule } from "@/features/teacher/teacher-schedule";
import LessonSchedulePage from "../../lessons/schedule/page";

export default function MyLessonSchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (isTeacher(user?.role)) return <TeacherSchedule slug={slug} />;
  return <LessonSchedulePage params={params} />;
}
