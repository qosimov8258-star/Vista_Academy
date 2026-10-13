"use client";

import { use } from "react";
import { useAuth } from "@/lib/use-auth";
import { isTeacher } from "@/lib/permissions";
import { LoadingState } from "@/components/ui/states";
import { TeacherAttendance } from "@/features/teacher/teacher-attendance";
import { BranchAttendance } from "@/features/attendance/branch-attendance";

/**
 * Tarbiyachi (va yordamchi) telefon uchun qilingan o'z ko'rinishini oladi;
 * filial admini, administrator va direktor — iOS uslubidagi filial
 * davomati (features/attendance/branch-attendance.tsx).
 */
export default function AttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (isTeacher(user?.role)) return <TeacherAttendance slug={slug} />;
  return <BranchAttendance slug={slug} />;
}
