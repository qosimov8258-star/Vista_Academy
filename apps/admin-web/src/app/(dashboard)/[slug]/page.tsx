"use client";

import { OperatorHome } from "@/features/desk/operator-home";
import { use } from "react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TodayRemindersCard } from "@/features/child-notes/today-reminders-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatMoney } from "@/lib/format";
import { canWriteOperational, canWriteTeaching, isChef, isTeacher } from "@/lib/permissions";
import { isCallOperatorUser, isCashierPosition } from "@/lib/employee-position";
import { ChefHome } from "@/features/nutrition/chef-home";
import { CashierHome } from "@/features/cash/cashier-home";
import { AdminHome } from "@/features/desk/admin-home";
import { DirectorHome } from "@/features/director/director-home";
import { TeacherHome } from "@/features/teacher/teacher-home";
import {
  BellIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ChildIcon,
  GroupIcon,
  MealIcon,
  MoneyIcon,
  NoteIcon,
  PhoneIcon,
  TeacherIcon,
} from "@/components/ui/icons";

const QUICK_ACTIONS = [
  { label: "Arizalar (CRM)", icon: PhoneIcon, suffix: "crm" },
  { label: "Bolalar", icon: ChildIcon, suffix: "children" },
  { label: "Guruhlar", icon: GroupIcon, suffix: "groups" },
  { label: "Moliya", icon: MoneyIcon, suffix: "finance" },
  { label: "Davomat", icon: ChecklistIcon, suffix: "attendance" },
  { label: "Kundalik hisobot", icon: NoteIcon, suffix: "daily-reports" },
  { label: "Xodimlar davomati", icon: CalendarIcon, suffix: "staff-attendance" },
  { label: "Ovqatlanish", icon: MealIcon, suffix: "nutrition" },
  { label: "Ish haqi (HR)", icon: BriefcaseIcon, suffix: "hr" },
  { label: "Bildirishnomalar", icon: BellIcon, suffix: "notifications" },
];

// Intl uz-UZ lokali oy va hafta kunini o'zbekcha bermaydi ("M09 8, Tue"),
// shuning uchun nomlar qo'lda yoziladi.
const MONTH_NAMES = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const WEEKDAY_NAMES = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

function todayLabel(): string {
  const now = new Date();
  return `${now.getDate()}-${MONTH_NAMES[now.getMonth()]}, ${WEEKDAY_NAMES[now.getDay()]}`;
}

/** Kunlik ish kartasi: bajarilgan / jami, yo'lak va bitta aniq amal. */
function TodayCard({
  title,
  icon: Icon,
  done,
  total,
  breakdown,
  href,
  actionLabel,
  tone = "primary",
}: {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  done: number;
  total: number;
  breakdown?: { label: string; value: number; tone: "success" | "danger" }[];
  href?: string;
  actionLabel?: string;
  tone?: "primary" | "success" | "warning";
}) {
  const complete = total > 0 && done >= total;

  return (
    <Card className="flex flex-col rounded-[24px] p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent-soft-icon)]">
          <Icon className="h-[20px] w-[20px]" />
        </span>
        <p className="text-[14px] font-semibold text-[var(--color-text)]">{title}</p>
      </div>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none tabular-nums text-[var(--color-text)]">{done}</span>
        <span className="text-[15px] text-[var(--color-text-muted)]">/ {total}</span>
        {complete && (
          <Badge tone="success" className="ml-auto">
            Tugallandi
          </Badge>
        )}
      </p>

      <ProgressBar value={done} total={total} tone={complete ? "success" : tone} className="mt-3" />

      {breakdown && (
        <div className="mt-3 flex gap-4">
          {breakdown.map((item) => (
            <div key={item.label}>
              <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">{item.label}</p>
              <p
                className={`text-[15px] font-semibold tabular-nums ${
                  item.tone === "success" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {href && actionLabel && (
        <Link
          href={href}
          className="group mt-3 inline-flex w-fit items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-2 text-[13px] font-semibold text-[var(--accent-soft-ink)] transition-transform active:scale-[0.97]"
        >
          {actionLabel}
          <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </Card>
  );
}

/** Bitta raqamli kichik plitka; bosilsa tegishli bo'limga olib boradi. */
function StatTile({
  label,
  value,
  icon: Icon,
  href,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
          highlight
            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
            : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">{label}</p>
        <p className="text-[18px] font-semibold leading-tight tabular-nums text-[var(--color-text)]">{value}</p>
      </div>
      {href && (
        <ChevronRightIcon className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-muted)]/50 transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  const className =
    "group flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 py-3 shadow-[var(--shadow-card)]";

  return href ? (
    <Link
      href={href}
      className={`${className} transition-all duration-[var(--dur-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:bg-[var(--color-surface-hover)] hover:shadow-[var(--shadow-raised)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 px-0.5 text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
      {children}
    </h2>
  );
}

export default function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const canTeach = canWriteTeaching(user?.role);
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";
  const teacher = isTeacher(user?.role);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug],
    queryFn: () => api.get<DashboardSummary>("/app/dashboard/summary"),
    // Oshpazga filial xulosasi (moliya bilan) yopiq — uning sahifasi o'z ma'lumotini oladi
    enabled: !!user && !isChef(user.role),
  });

  if (orgQuery.isLoading) return <LoadingState rows={4} />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  const org = orgQuery.data;
  if (!org) return null;

  // Kassir guruh bilan ishlamaydi — o'z kassa sahifasini ko'radi.
  if (user?.position && isCashierPosition(user.position)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {user?.branchName ?? org.name}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">Bugun · {todayLabel()}</p>
        </div>
        <CashierHome slug={slug} />
      </div>
    );
  }

  // Oshpaz dars o'tmaydi — unga porsiyalar, bugungi taomlar va allergiyalar ko'rsatiladi
  // (sarlavha va sana ChefHome'ning o'zida).
  if (isChef(user?.role)) {
    return <ChefHome slug={slug} />;
  }

  // Tarbiyachi (yordamchi va fan o'qituvchisi ham) — iOS uslubidagi o'z bosh sahifasi
  if (teacher) {
    return <TeacherHome slug={slug} />;
  }

  // Call operator — faqat telefon ishlari: qo'ng'iroq soni va ro'yxat
  if (isCallOperatorUser(user)) {
    return <OperatorHome slug={slug} />;
  }

  // Administrator (MANAGER) uchun alohida bosh sahifa: bugungi holat va qo'ng'iroqlar.
  if (user?.role === "MANAGER") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {user?.branchName ?? org.name}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">Bugun · {todayLabel()}</p>
        </div>
        <AdminHome slug={slug} />
      </div>
    );
  }

  // Bog'cha direktori (Super Admin) — tarmoq bo'yicha iOS uslubidagi bosh sahifa
  if (isNetworkAdmin) {
    return <DirectorHome slug={slug} org={org} />;
  }

  const summary = summaryQuery.data;
  const children = summary?.childrenCount ?? 0;
  const employees = summary?.employeesCount ?? 0;
  const attendanceMarked = (summary?.todayAttendance.present ?? 0) + (summary?.todayAttendance.absent ?? 0);
  const staffMarked = (summary?.todayStaffAttendance.present ?? 0) + (summary?.todayStaffAttendance.absent ?? 0);
  const debt = summary?.outstandingDebt ?? 0;

  // Bolalar ro'yxatga olinmaguncha kunlik ish kartalari bo'sh raqamlardan
  // iborat bo'ladi — bunday holatda nima qilish kerakligini aytgan ma'qul.
  const notStartedYet = !summaryQuery.isLoading && children === 0;

  return (
    <div className="space-y-6">
      {/* Tepa kartochka: filial, sana va asosiy raqamlar — panel bilan bir xil to'q yashil */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,var(--accent-rail)_0%,var(--accent-rail-2)_100%)] p-5 text-white shadow-[0_18px_40px_-20px_color-mix(in_srgb,var(--accent-rail)_70%,transparent)] md:p-6">
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[var(--accent-bright)]/15 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[var(--accent-light)]/10 blur-2xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-[13px] font-medium text-[var(--accent-pale)]/80">Bugun · {todayLabel()}</p>
          <h1 data-hero className="mt-0.5 text-[26px] font-bold tracking-[-0.02em]">{user?.branchName ?? org.name}</h1>
          <p className="text-[13px] text-[var(--accent-pale)]/70">{org.name}</p>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[
              { label: "Bolalar", value: children },
              { label: "Xodimlar", value: employees },
              { label: "Keldi", value: summary?.todayAttendance.present ?? 0 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[18px] bg-white/10 px-3 py-3 backdrop-blur">
                <p className="text-[24px] font-extrabold leading-none tabular-nums text-white">
                  {summaryQuery.isLoading ? "–" : stat.value}
                </p>
                <p className="mt-1.5 text-[12px] font-medium text-[var(--accent-pale)]/80">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/${slug}/attendance`}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--accent-bright)] px-4 text-[13.5px] font-bold text-[var(--accent-rail)] transition-transform active:scale-[0.96]"
            >
              Bolalar davomati
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/${slug}/staff-attendance`}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13.5px] font-semibold text-white transition-transform active:scale-[0.96]"
            >
              Xodimlar davomati
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {summaryQuery.isError ? (
        <ErrorState message={(summaryQuery.error as Error).message} />
      ) : (
        <>
          {/* Tarbiyachi yozgan bugungi eslatmalar (dori vaqti va h.k.) — filial darajasidagi hamma ko'radi */}
          {user?.branchId && (
            <TodayRemindersCard
              slug={slug}
              branchId={user.branchId}
              today={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date())}
            />
          )}

          {notStartedYet ? (
            <Card className="p-5">
              <p className="text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                Boshlash uchun
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
                Bu filialda hali bola ro&apos;yxatga olinmagan. Guruh ochib, bolalarni qo&apos;shsangiz, davomat va kundalik hisobot shu yerda ko&apos;rina boshlaydi.
              </p>
              {canWrite && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {/* Link'lar tugma bo'la olmaydi, shuning uchun Button'ning
                      `outline` va `primary` ko'rinishi shu yerda takrorlanadi. */}
                  <Link
                    href={`/${slug}/groups`}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-4 text-[14px] font-semibold tracking-[-0.006em] text-[var(--color-text)] shadow-[var(--shadow-xs)] transition-[transform,background-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-hover)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    Guruh ochish
                  </Link>
                  <Link
                    href={`/${slug}/children`}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--color-primary)] px-4 text-[14px] font-semibold tracking-[-0.006em] text-white shadow-[var(--shadow-primary)] transition-[transform,background-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-primary-hover)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    Bola qo&apos;shish
                  </Link>
                </div>
              )}
            </Card>
          ) : (
            <section>
              <SectionTitle>Bugungi ish</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TodayCard
                  title="Bolalar davomati"
                  icon={ChecklistIcon}
                  done={attendanceMarked}
                  total={children}
                  breakdown={[
                    { label: "Keldi", value: summary?.todayAttendance.present ?? 0, tone: "success" },
                    { label: "Kelmadi", value: summary?.todayAttendance.absent ?? 0, tone: "danger" },
                  ]}
                  href={`/${slug}/attendance`}
                  actionLabel={canTeach ? "Davomatni belgilash" : "Ko'rish"}
                />
                <TodayCard
                  title="Xodimlar davomati"
                  icon={CalendarIcon}
                  done={staffMarked}
                  total={employees}
                  breakdown={[
                    { label: "Keldi", value: summary?.todayStaffAttendance.present ?? 0, tone: "success" },
                    { label: "Kelmadi", value: summary?.todayStaffAttendance.absent ?? 0, tone: "danger" },
                  ]}
                  href={`/${slug}/staff-attendance`}
                  actionLabel={canWrite ? "Davomatni belgilash" : "Ko'rish"}
                />
              </div>
            </section>
          )}

          {summary && (
            <section>
              <SectionTitle>Diqqat talab qiladi</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Card className="p-4">
                  <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Bugun belgilanmagan</p>
                  {summary.attention.unmarkedAttendance.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-[var(--color-success)]">Hammasi belgilangan</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {summary.attention.unmarkedAttendance.length > 0 && (
                        <p className="text-[12.5px] text-[var(--color-text-muted)]">
                          Davomat:{" "}
                          <span className="font-medium text-[var(--color-text)]">
                            {summary.attention.unmarkedAttendance
                              .slice(0, 3)
                              .map((c) => c.fullName)
                              .join(", ")}
                            {summary.attention.unmarkedAttendance.length > 3 &&
                              ` +${summary.attention.unmarkedAttendance.length - 3}`}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Vaksinatsiya muddati o&apos;tgan</p>
                  {summary.attention.overdueVaccinations.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-[var(--color-success)]">Yo&apos;q</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {summary.attention.overdueVaccinations.slice(0, 3).map((v) => (
                        <li key={`${v.childId}-${v.vaccineName}`} className="text-[12.5px] text-[var(--color-text)]">
                          {v.fullName} <span className="text-[var(--color-text-muted)]">— {v.vaccineName}</span>
                        </li>
                      ))}
                      {summary.attention.overdueVaccinations.length > 3 && (
                        <li className="text-[12.5px] text-[var(--color-text-muted)]">
                          +{summary.attention.overdueVaccinations.length - 3} ta
                        </li>
                      )}
                    </ul>
                  )}
                </Card>

                <Card className="p-4">
                  <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Tug&apos;ilgan kunlar (7 kun)</p>
                  {summary.upcomingBirthdays.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-[var(--color-text-muted)]">Yaqin kunlarda yo&apos;q</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {summary.upcomingBirthdays.slice(0, 3).map((b) => (
                        <li key={b.childId} className="text-[12.5px] text-[var(--color-text)]">
                          {b.fullName}{" "}
                          <span className="text-[var(--color-text-muted)]">
                            — {b.daysUntil === 0 ? "bugun" : `${b.daysUntil} kundan keyin`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="p-4">
                  <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Guruhlar to&apos;lganligi</p>
                  <p className="mt-1.5 text-[20px] font-semibold leading-none tabular-nums text-[var(--color-text)]">
                    {summary.groupCapacity.totalCapacity > 0
                      ? `${Math.round((summary.groupCapacity.totalActive / summary.groupCapacity.totalCapacity) * 100)}%`
                      : "—"}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {summary.groupCapacity.totalActive} / {summary.groupCapacity.totalCapacity}
                  </p>
                  {summary.groupCapacity.groups.some((g) => g.percent >= 90) && (
                    <p className="mt-1.5 text-[12px] text-[var(--color-danger)]">
                      {summary.groupCapacity.groups.filter((g) => g.percent >= 90).map((g) => g.name).join(", ")} —
                      to&apos;lib bo&apos;lgan
                    </p>
                  )}
                </Card>

                <Card className="p-4">
                  <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Eng ko&apos;p qarzdorlar</p>
                  {summary.topDebtors.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-[var(--color-success)]">Qarzdor yo&apos;q</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {summary.topDebtors.slice(0, 3).map((d) => (
                        <li key={d.childId} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="truncate text-[var(--color-text)]">{d.fullName}</span>
                          <span className="shrink-0 tabular-nums text-[var(--color-danger)]">{formatMoney(d.balance)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/${slug}/finance`}
                    className="mt-2 inline-block text-[12.5px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Moliya →
                  </Link>
                </Card>
              </div>
            </section>
          )}

          <section>
            <SectionTitle>Moliya</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-[13px] text-[var(--color-text-muted)]">Joriy oy tushumi</p>
                <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-[var(--color-success)]">
                  {formatMoney(summary?.monthRevenue ?? 0)}
                </p>
                {summary && summary.previousMonthRevenue > 0 && (
                  <p className="mt-1.5 text-[12.5px] text-[var(--color-text-muted)]">
                    {(() => {
                      const change = Math.round(
                        ((summary.monthRevenue - summary.previousMonthRevenue) / summary.previousMonthRevenue) * 100,
                      );
                      return (
                        <span className={change >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
                        </span>
                      );
                    })()}{" "}
                    o&apos;tgan oyga nisbatan
                  </p>
                )}
              </Card>
              <Card className={`p-4 ${debt > 0 ? "border-[var(--color-danger)]/25" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] text-[var(--color-text-muted)]">Qarzdorlik</p>
                  {debt > 0 && <Badge tone="danger">To&apos;lanishi kerak</Badge>}
                </div>
                <p
                  className={`mt-1.5 text-[26px] font-semibold leading-none tabular-nums ${
                    debt > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
                  }`}
                >
                  {formatMoney(debt)}
                </p>
                {!!summary?.overdueInvoicesCount && (
                  <p className="mt-1.5 text-[12.5px] text-[var(--color-danger)]">
                    {summary.overdueInvoicesCount} ta hisob-faktura muddati o&apos;tgan
                  </p>
                )}
                {debt > 0 && (
                  <Link
                    href={`/${slug}/finance`}
                    className="group mt-3 inline-flex items-center gap-0.5 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    Hisob-fakturalarni ko&apos;rish
                    <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </Card>
            </div>
          </section>

          <section>
            <SectionTitle>Filial raqamlari</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <StatTile label="Bolalar" value={children} icon={ChildIcon} href={`/${slug}/children`} />
              <StatTile
                label="Faol guruhlar"
                value={summary?.activeGroupsCount ?? 0}
                icon={GroupIcon}
                href={`/${slug}/groups`}
              />
              <StatTile label="Xodimlar" value={employees} icon={TeacherIcon} href={`/${slug}/employees`} />
              <StatTile
                label="Faol arizalar"
                value={summary?.activeLeadsCount ?? 0}
                icon={PhoneIcon}
                href={`/${slug}/crm`}
                highlight={(summary?.activeLeadsCount ?? 0) > 0}
              />
              <StatTile
                label="Yuborilmagan xabar"
                value={summary?.pendingNotificationsCount ?? 0}
                icon={BellIcon}
                href={`/${slug}/notifications`}
                highlight={(summary?.pendingNotificationsCount ?? 0) > 0}
              />
            </div>
          </section>

          <section>
            <SectionTitle>Bo&apos;limlar</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.suffix}
                    href={`/${slug}/${action.suffix}`}
                    className="group flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3 py-4 text-center shadow-[var(--shadow-card)] transition-all duration-[var(--dur-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:bg-[var(--color-surface-hover)] hover:shadow-[var(--shadow-raised)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors duration-[var(--dur-fast)] group-hover:bg-[var(--color-primary)] group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[12px] font-medium leading-tight text-[var(--color-text)]">
                      {action.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

        </>
      )}
    </div>
  );
}
