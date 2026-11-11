"use client";

// O'qituvchi kabinetining o'z manzili — filial adminining `/lessons/schedule`
// sahifasi bilan bir xil URL bo'lmasin (aks holda ikkalasi xuddi bitta joy
// bo'lib chalkashtirib yuboradi). Tarbiyachi telefon uchun qilingan iOS
// jadvalini ko'radi; boshqa rol bu manzilga tushib qolsa — umumiy sahifa.
import { use } from "react";
import { useAuth } from "@/lib/use-auth";
import { isTeacher } from "@/lib/permissions";
import { SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK } from "@/components/ios/tokens";
import { TeacherSchedule } from "@/features/teacher/teacher-schedule";
import LessonSchedulePage from "../../lessons/schedule/page";

export default function MyLessonSchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className={GROUP_BLOCK}>
        <SkeletonRows rows={3} />
      </div>
    );
  }
  if (isTeacher(user?.role)) return <TeacherSchedule slug={slug} />;
  return <LessonSchedulePage params={params} />;
}
