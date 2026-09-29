"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, EmployeeNotification, Group as GroupModel, LessonSchedule, Weekday } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { isAssistantPosition, isSubjectTeacherPosition } from "@/lib/employee-position";
import { Avatar } from "@/components/ui/avatar";
import { BellIcon, CalendarIcon, ClockIcon, GroupIcon } from "@/components/ui/icons";
import { EmptyRow, Group, GroupAction, LargeTitle, PrimaryButton, Row, SkeletonRows, TeacherPage, formatDayLong, todayIso } from "./teacher-ui";
import { TeacherReminders } from "./teacher-reminders";
import styles from "./teacher.module.css";

const WEEK: { key: Weekday; label: string }[] = [
  { key: "MONDAY", label: "Dushanba" },
  { key: "TUESDAY", label: "Seshanba" },
  { key: "WEDNESDAY", label: "Chorshanba" },
  { key: "THURSDAY", label: "Payshanba" },
  { key: "FRIDAY", label: "Juma" },
  { key: "SATURDAY", label: "Shanba" },
  { key: "SUNDAY", label: "Yakshanba" },
];
const WEEKDAY_BY_JS_DAY: Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
/** Bosh sahifada ko'rinadigan darslar soni — qolgani "Jadval"da */
const LESSONS_PREVIEW = 5;

function greeting(hour: number) {
  if (hour >= 5 && hour < 11) return "Xayrli tong";
  if (hour >= 11 && hour < 17) return "Xayrli kun";
  if (hour >= 17 && hour < 22) return "Xayrli kech";
  return "Xayrli tun";
}

function tashkentHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

/**
 * Tarbiyachi bosh sahifasi — iOS uslubida: katta salomlashuv, bugungi
 * davomat halqasi, eslatmalar, guruhlar va haftalik darslar guruhlangan
 * ro'yxatda. Rangli fonli ikonkalar yo'q — belgilar tizim rangida.
 */
export function TeacherHome({ slug }: { slug: string }) {
  const { user } = useAuth();
  const today = todayIso();
  const todayWeekday = WEEKDAY_BY_JS_DAY[new Date().getDay()];
  const subjectTeacher = !!user?.position && isSubjectTeacherPosition(user.position);
  // Yordamchi davomatni faqat ko'radi — belgilash tarbiyachiniki
  const canMark = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug],
    queryFn: () => api.get<DashboardSummary>("/app/dashboard/summary"),
  });
  // Tarbiyachida bu so'rovlar faqat unga biriktirilgan guruhlarni qaytaradi
  const groupsQuery = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<GroupModel[]>("/app/groups"),
  });
  const lessonsQuery = useQuery({
    queryKey: ["lesson-schedules", slug, "dashboard"],
    queryFn: () => api.get<LessonSchedule[]>("/app/lesson-schedules"),
  });
  // Yuqori panel bilan bir xil kalit — qo'shimcha so'rov ketmaydi
  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
    refetchInterval: 60_000,
  });
  const unread = notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0;

  const s = summaryQuery.data;
  const total = s?.childrenCount ?? 0;
  const present = s?.todayAttendance.present ?? 0;
  const absent = s?.todayAttendance.absent ?? 0;
  const marked = present + absent;
  const groups = groupsQuery.data ?? [];

  // Hafta dushanbadan; bugungi va keyingi darslar birinchi turadi
  const todayIndex = WEEK.findIndex((d) => d.key === todayWeekday);
  const lessons = WEEK.map((day, i) => ({ ...day, order: (i - todayIndex + 7) % 7 }))
    .sort((a, b) => a.order - b.order)
    .flatMap((day) =>
      (lessonsQuery.data ?? [])
        .filter((l) => l.weekday === day.key)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((lesson) => ({ lesson, day })),
    );

  const attendanceHref = subjectTeacher ? `/${slug}/lesson-attendance` : `/${slug}/attendance`;

  return (
    <TeacherPage>
      <LargeTitle
        eyebrow={formatDayLong(today)}
        title={greeting(tashkentHour())}
        subtitle={[user?.fullName, groups.map((g) => g.name).join(", ")].filter(Boolean).join(" · ")}
        trailing={
          <Link href={`/${slug}/settings`} aria-label="Profil" className="block rounded-full transition-transform active:scale-95">
            <Avatar user={user} size={46} />
          </Link>
        }
      />

      {/* Bugungi davomat — asosiy ish */}
      {!subjectTeacher && (
        <section className={`${styles.group} p-5`}>
          {summaryQuery.isLoading ? (
            <div className="flex items-center gap-5">
              <span className="h-[104px] w-[104px] shrink-0 animate-pulse rounded-full bg-black/[0.05]" />
              <span className="flex-1 space-y-2.5">
                <span className="block h-4 w-3/4 animate-pulse rounded-full bg-black/[0.06]" />
                <span className="block h-3 w-1/2 animate-pulse rounded-full bg-black/[0.04]" />
              </span>
            </div>
          ) : total === 0 ? (
            <EmptyRow
              icon={GroupIcon}
              title="Hozircha ish yo'q"
              description="Guruhingizda hali bola yo'q. Filial admini bolalarni ro'yxatga olgach, davomat shu yerda paydo bo'ladi."
            />
          ) : (
            <>
              <div className="flex items-center gap-5">
                <AttendanceRing present={present} absent={absent} total={total} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">Bugungi davomat</p>
                  <p className="mt-1 text-[19px] font-bold leading-snug tracking-[-0.015em] text-[var(--color-text)]">
                    {marked === 0 ? "Hali belgilanmagan" : marked >= total ? "Hammasi belgilandi" : `${total - marked} ta bola qoldi`}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                    <Legend color="var(--color-success)" label="Keldi" value={present} />
                    <Legend color="var(--color-danger)" label="Kelmadi" value={absent} />
                  </div>
                </div>
              </div>
              <PrimaryButton href={attendanceHref} className="mt-5">
                {!canMark ? "Davomatni ko'rish" : marked === 0 ? "Davomatni belgilash" : "Davomatni ochish"}
              </PrimaryButton>
            </>
          )}
        </section>
      )}

      {user?.branchId && <TeacherReminders slug={slug} branchId={user.branchId} date={today} />}

      {subjectTeacher && (
        <PrimaryButton href={attendanceHref}>Dars davomatini belgilash</PrimaryButton>
      )}

      <Group title="Guruhlarim">
        {groupsQuery.isLoading ? (
          <SkeletonRows rows={1} />
        ) : groups.length === 0 ? (
          <EmptyRow icon={GroupIcon} title="Sizga hali guruh biriktirilmagan" description="Filial admini guruh biriktirgach, shu yerda ko'rinadi." />
        ) : (
          groups.map((group, i) => (
            <Row
              key={group.id}
              first={i === 0}
              icon={GroupIcon}
              title={group.name}
              value={`${group._count?.children ?? 0} bola`}
              href={subjectTeacher ? undefined : `/${slug}/children`}
            />
          ))
        )}
      </Group>

      <Group
        title={subjectTeacher ? "Darslarim" : "Bu haftaki darslar"}
        action={lessons.length > 0 ? <GroupAction href={`/${slug}/my-lessons/schedule`}>Jadval</GroupAction> : undefined}
      >
        {lessonsQuery.isLoading ? (
          <SkeletonRows rows={2} />
        ) : lessons.length === 0 ? (
          <EmptyRow icon={ClockIcon} title="Bu hafta dars yo'q" />
        ) : (
          lessons.slice(0, LESSONS_PREVIEW).map(({ lesson, day }, i) => {
            const isToday = day.key === todayWeekday;
            return (
              <Row
                key={lesson.id}
                first={i === 0}
                leading={
                  <span className="flex w-[40px] shrink-0 flex-col items-start leading-tight tabular-nums">
                    <span className="text-[15px] font-semibold text-[var(--color-text)]">{lesson.startTime}</span>
                    <span className="text-[12.5px] text-[var(--color-text-muted)]">{lesson.endTime}</span>
                  </span>
                }
                title={lesson.subject || "Dars"}
                subtitle={`${lesson.group.name} guruhi`}
                trailing={
                  isToday ? (
                    <span className="shrink-0 rounded-full bg-[var(--color-primary)] px-2.5 py-1 text-[12px] font-semibold text-white">Bugun</span>
                  ) : (
                    <span className="shrink-0 text-[14px] text-[var(--color-text-muted)]">{day.label}</span>
                  )
                }
              />
            );
          })
        )}
        {lessons.length > LESSONS_PREVIEW && (
          <Row icon={CalendarIcon} title={`Yana ${lessons.length - LESSONS_PREVIEW} ta dars`} href={`/${slug}/my-lessons/schedule`} />
        )}
      </Group>

      <Group>
        <Row
          first
          icon={BellIcon}
          title="Bildirishnomalar"
          href={`/${slug}/my-notifications`}
          trailing={
            unread > 0 ? (
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 text-[12.5px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : undefined
          }
        />
        {!subjectTeacher && <Row icon={CalendarIcon} title="Dars jadvali" href={`/${slug}/my-lessons/schedule`} />}
      </Group>
    </TeacherPage>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
      <b className="font-semibold tabular-nums text-[var(--color-text)]">{value}</b>
    </span>
  );
}

/** Davomat halqasi: yashil — kelgan, qizil — kelmagan, kulrang — belgilanmagan. */
function AttendanceRing({ present, absent, total }: { present: number; absent: number; total: number }) {
  const size = 104;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTotal = Math.max(total, 1);
  const presentLen = (Math.min(present, safeTotal) / safeTotal) * c;
  const absentLen = (Math.min(absent, safeTotal - Math.min(present, safeTotal)) / safeTotal) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${total} boladan ${present} tasi keldi, ${absent} tasi kelmadi`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(118,118,128,0.14)" strokeWidth={stroke} />
        {absentLen > 0 && (
          <circle
            className={styles.ring}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${absentLen} ${c}`}
            strokeDashoffset={-presentLen}
          />
        )}
        {presentLen > 0 && (
          <circle
            className={styles.ring}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-success)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${presentLen} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]">{present}</span>
        <span className="mt-1 text-[12.5px] font-medium tabular-nums text-[var(--color-text-muted)]">/ {total}</span>
      </div>
    </div>
  );
}
