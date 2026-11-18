"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, EmployeeNotification, Group as GroupModel, LessonSchedule, Weekday } from "@/lib/types";
import { useAuth, useFeatureFlags } from "@/lib/use-auth";
import { useRouteFeatureOn } from "@/lib/feature-routes";
import { canViewUseful, canWriteTeaching } from "@/lib/permissions";
import { isAssistantPosition, isSubjectTeacherPosition } from "@/lib/employee-position";
import { Avatar } from "@/components/ui/avatar";
import { ArrowRight, Baby, Bell, CalendarDays, Check, ClipboardCheck, Images, Newspaper, Paperclip, Smile, UsersRound } from "lucide-react";
import { CalendarIcon, ClockIcon, GroupIcon } from "@/components/ios/icons";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import { EmptyRow, Group, GroupAction, Row, SkeletonRows, TeacherPage, formatDayLong, todayIso } from "./teacher-ui";
import { TeacherReminders } from "./teacher-reminders";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";
import { useEmployeeInboxUnread } from "@/features/broadcasts/use-inbox";

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
 * Tarbiyachi bosh sahifasi — zamonaviy ilova ko'rinishida (ota-ona bosh
 * sahifasi bilan bir uslub): kartasiz salomlashuv, tizim rangidagi bugungi
 * davomat kartasi va katta oq tugma (bosh barmoq uchun), iOS ilova
 * yorliqlari, eslatmalar, guruhlar va haftalik darslar — yumshoq soyali
 * kartalarda.
 */
export function TeacherHome({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const today = todayIso();
  const todayWeekday = WEEKDAY_BY_JS_DAY[new Date().getDay()];
  const subjectTeacher = !!user?.position && isSubjectTeacherPosition(user.position);
  // Yordamchi davomatni faqat ko'radi — belgilash tarbiyachiniki
  const canMark = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));
  // Platforma o'chirgan bo'limlar: so'rov ketmaydi, havola ko'rinmaydi
  const features = useFeatureFlags();
  const routeOn = useRouteFeatureOn();
  const lessonsOn = features.isOn("lessons");
  const bellOn = features.ready && features.isOn("employeeNotifications");

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
    enabled: lessonsOn,
  });
  // Yuqori panel bilan bir xil kalit — qo'shimcha so'rov ketmaydi
  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
    refetchInterval: 60_000,
    enabled: bellOn,
  });
  const inboxUnread = useEmployeeInboxUnread(slug, bellOn);
  const unread = (notificationsQuery.data?.filter((n) => !n.isRead).length ?? 0) + inboxUnread;

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
  const attendanceOn = routeOn(attendanceHref);
  const materialsOn = routeOn(`/${slug}/materials`);
  const scheduleOn = lessonsOn && routeOn(`/${slug}/my-lessons/schedule`);
  const usefulOn = !!user && canViewUseful(user.role) && !subjectTeacher;
  const todayLessons = lessons.filter(({ day }) => day.key === todayWeekday).length;
  // Kayfiyat belgilash — guruh tarbiyachisi (yordamchi faqat ko'radi, fan o'qituvchisida guruh bolalari yo'q)
  const moodOn = canMark && !subjectTeacher && routeOn(`/${slug}/mood`);

  // Ilova yorliqlari — eng ko'p kerak bo'ladiganlari, ko'pi bilan 4 ta (+ «Kayfiyat», u bo'lsa).
  // «Kayfiyat» birinchi va qo'shimcha o'rin oladi — qolgan yorliqlar avvalgidek qoladi.
  const shortcuts: Shortcut[] = ([
    moodOn && { key: "mood", label: "Kayfiyat", icon: Smile, tint: "green", href: `/${slug}/mood` },
    materialsOn && { key: "materials", label: "Vazifa", icon: Paperclip, tint: "teal", href: `/${slug}/materials` },
    usefulOn && routeOn(`/${slug}/useful/gallery`) && { key: "gallery", label: "Galereya", icon: Images, tint: "pink", href: `/${slug}/useful/gallery` },
    scheduleOn && { key: "schedule", label: "Jadval", icon: CalendarDays, tint: "orange", href: `/${slug}/my-lessons/schedule` },
    bellOn && { key: "bell", label: "Xabarlar", icon: Bell, tint: "red", href: `/${slug}/my-notifications`, badge: unread },
    !subjectTeacher && routeOn(`/${slug}/children`) && { key: "children", label: "Bolalar", icon: Baby, tint: "indigo", href: `/${slug}/children` },
    usefulOn && routeOn(`/${slug}/useful/articles`) && { key: "articles", label: "Maqolalar", icon: Newspaper, tint: "purple", href: `/${slug}/useful/articles` },
  ] as (Shortcut | false)[])
    .filter((item): item is Shortcut => !!item)
    .slice(0, moodOn ? 5 : 4);

  const status = marked === 0 ? "Kutilmoqda" : marked >= total ? "Bajarildi" : `${marked}/${total}`;

  return (
    <TeacherPage>
      {/* Salomlashuv — kartasiz, ilovalardagi kabi */}
      <header className="flex items-center gap-3 px-1 pt-1">
        <Link href={`/${slug}/settings`} aria-label={tr("Profil")} className="block shrink-0 rounded-full transition-transform active:scale-95">
          <Avatar user={user} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] leading-tight text-[#8e8e93]">{tr(greeting(tashkentHour()))}</p>
          <h1 data-hero className="mt-0.5 truncate text-[23px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-text)]">
            {user?.fullName ?? tr("Xush kelibsiz")}
          </h1>
        </div>
      </header>

      {/* Bugungi davomat — asosiy ish, rangli karta */}
      {!subjectTeacher && attendanceOn && (
        <section className={`${styles.hero} p-5`}>
          <div className="relative flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] font-medium text-white/75">{tr(formatDayLong(today))}</p>
            {!summaryQuery.isLoading && total > 0 && (
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 text-[12.5px] font-semibold">
                {marked >= total ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
                {tr(status)}
              </span>
            )}
          </div>

          {summaryQuery.isLoading ? (
            <div className="relative mt-4 flex items-center gap-5">
              <span className="h-[96px] w-[96px] shrink-0 animate-pulse rounded-full bg-white/20" />
              <span className="flex-1 space-y-2.5">
                <span className="block h-4 w-3/4 animate-pulse rounded-full bg-white/25" />
                <span className="block h-3 w-1/2 animate-pulse rounded-full bg-white/15" />
              </span>
            </div>
          ) : total === 0 ? (
            <div className="relative mt-4 flex items-start gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/20">
                <UsersRound className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[18px] font-bold leading-snug">{tr("Hozircha ish yo'q")}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-white/80">
                  {tr("Guruhingizda hali bola yo'q. Filial admini bolalarni ro'yxatga olgach, davomat shu yerda paydo bo'ladi.")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mt-4 flex items-center gap-5">
                <AttendanceRing present={present} absent={absent} total={total} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/75">{tr("Bugungi davomat")}</p>
                  <p className="mt-0.5 text-[20px] font-bold leading-snug tracking-[-0.015em]">
                    {marked === 0 ? tr("Hali belgilanmagan") : marked >= total ? tr("Hammasi belgilandi") : tr("{0} ta bola qoldi", total - marked)}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Legend color="#ffffff" label="Keldi" value={present} />
                    <Legend color={ABSENT_ON_HERO} label="Kelmadi" value={absent} />
                  </div>
                </div>
              </div>
              <HeroButton href={attendanceHref}>
                {!canMark ? tr("Davomatni ko'rish") : marked === 0 ? tr("Davomatni belgilash") : tr("Davomatni ochish")}
              </HeroButton>
            </>
          )}
        </section>
      )}

      {/* Fan o'qituvchisi — dars davomati */}
      {subjectTeacher && attendanceOn && (
        <section className={`${styles.hero} p-5`}>
          <p className="relative truncate text-[13px] font-medium text-white/75">{tr(formatDayLong(today))}</p>
          <div className="relative mt-3 flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/20">
              <ClipboardCheck className="h-6 w-6" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[20px] font-bold leading-snug tracking-[-0.015em]">{tr("Dars davomati")}</p>
              {lessonsOn && !lessonsQuery.isLoading && (
                <p className="mt-0.5 text-[13.5px] text-white/80">{todayLessons > 0 ? tr("Bugun {0} ta dars", todayLessons) : tr("Bugun dars yo'q")}</p>
              )}
            </div>
          </div>
          <HeroButton href={attendanceHref}>{tr("Dars davomatini belgilash")}</HeroButton>
        </section>
      )}

      {/* Ilova yorliqlari */}
      {shortcuts.length > 0 && (
        <nav aria-label={tr("Tezkor amallar")} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${shortcuts.length}, minmax(0, 1fr))` }}>
          {shortcuts.map((item) => (
            <Link key={item.key} href={item.href} className={`${styles.shortcut} flex min-w-0 flex-col items-center rounded-[18px] px-1 py-1.5`}>
              <span className="relative">
                <IosIcon icon={item.icon} tint={item.tint} size={54} />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[12px] font-bold text-white ring-2 ring-[var(--color-bg)]">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              <span className="mt-2 w-full truncate text-center text-[12.5px] font-medium leading-tight text-[var(--color-text)]">{tr(item.label)}</span>
            </Link>
          ))}
        </nav>
      )}

      {user?.branchId && features.isOn("childReminders") && <TeacherReminders large slug={slug} branchId={user.branchId} date={today} />}

      <Group large title={tr("Guruhlarim")}>
        {groupsQuery.isLoading ? (
          <SkeletonRows rows={1} />
        ) : groups.length === 0 ? (
          <EmptyRow icon={GroupIcon} title={tr("Sizga hali guruh biriktirilmagan")} description={tr("Filial admini guruh biriktirgach, shu yerda ko'rinadi.")} />
        ) : (
          groups.map((group, i) => (
            <Row
              key={group.id}
              first={i === 0}
              leading={<IosIcon icon={UsersRound} tint="indigo" size={44} />}
              title={<span className="font-semibold">{tr(group.name)}</span>}
              subtitle={tr("{0} bola", group._count?.children ?? 0)}
              href={subjectTeacher ? undefined : `/${slug}/children`}
            />
          ))
        )}
      </Group>

      {lessonsOn && (
        <Group
          large
          title={subjectTeacher ? "Darslarim" : "Bu haftaki darslar"}
          action={lessons.length > 0 ? <GroupAction href={`/${slug}/my-lessons/schedule`}>{tr("Jadval")}</GroupAction> : undefined}
        >
          {lessonsQuery.isLoading ? (
            <SkeletonRows rows={2} />
          ) : lessons.length === 0 ? (
            <EmptyRow icon={ClockIcon} title={tr("Bu hafta dars yo'q")} />
          ) : (
            lessons.slice(0, LESSONS_PREVIEW).map(({ lesson, day }, i) => {
              const isToday = day.key === todayWeekday;
              return (
                <Row
                  key={lesson.id}
                  first={i === 0}
                  leading={
                    <span
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[13px] leading-none tabular-nums"
                      style={{
                        background: isToday ? "var(--color-primary)" : "rgba(118,118,128,0.12)",
                        color: isToday ? "#fff" : "var(--color-text)",
                      }}
                    >
                      <span className="text-[13.5px] font-bold">{tr(lesson.startTime)}</span>
                      <span className={isToday ? "mt-0.5 text-[10.5px] text-white/75" : "mt-0.5 text-[10.5px] text-[#8e8e93]"}>{tr(lesson.endTime)}</span>
                    </span>
                  }
                  title={<span className="font-semibold">{lesson.subject || tr("Dars")}</span>}
                  subtitle={`${groupLabel(lesson.group.name, tr("guruhi"))}${lesson.room ? ` · ${lesson.room.name}` : ""}`}
                  trailing={
                    isToday ? (
                      <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12.5px] font-semibold text-[var(--color-primary)]" style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}>
                        {tr("Bugun")}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[14px] text-[#8e8e93]">{tr(day.label)}</span>
                    )
                  }
                />
              );
            })
          )}
          {lessons.length > LESSONS_PREVIEW && (
            <Row icon={CalendarIcon} tint="orange" title={tr("Yana {0} ta dars", lessons.length - LESSONS_PREVIEW)} href={`/${slug}/my-lessons/schedule`} />
          )}
        </Group>
      )}
    </TeacherPage>
  );
}

/** «2-guruh» → «2-guruh», «Quyoshcha» → «Quyoshcha guruhi» (nomda «guruh» bo'lsa takrorlanmaydi) */
function groupLabel(name: string, suffix: string): string {
  return /guruh|групп|group/i.test(name) ? name : `${name} ${suffix}`;
}

type Shortcut = { key: string; label: string; icon: AnyIcon; tint: IosTint; href: string; badge?: number };

/** Kelmagan bolalar — rangli fonda o'qiladigan yumshoq qizil */
const ABSENT_ON_HERO = "#ffb1aa";

/** Rangli karta ichidagi oq kapsula tugma */
function HeroButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`${styles.cta} relative mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[16px] font-semibold text-[var(--color-primary)] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.35)]`}
    >
      {children}
      <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
    </Link>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  const tr = useTr();
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.16] px-2.5 text-[13px] text-white/85">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      {tr(label)}
      <b className="font-semibold tabular-nums text-white">{tr(value)}</b>
    </span>
  );
}

/** Davomat halqasi: yashil — kelgan, qizil — kelmagan, kulrang — belgilanmagan. */
function AttendanceRing({ present, absent, total }: { present: number; absent: number; total: number }) {
  const tr = useTr();
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTotal = Math.max(total, 1);
  const presentLen = (Math.min(present, safeTotal) / safeTotal) * c;
  const absentLen = (Math.min(absent, safeTotal - Math.min(present, safeTotal)) / safeTotal) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={tr("{0} boladan {1} tasi keldi, {2} tasi kelmadi", total, present, absent)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        {absentLen > 0 && (
          <circle
            className={styles.ring}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ABSENT_ON_HERO}
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
            stroke="#ffffff"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${presentLen} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums text-white">{tr(present)}</span>
        <span className="mt-1 text-[12.5px] font-medium tabular-nums text-white/70">/ {tr(total)}</span>
      </div>
    </div>
  );
}
