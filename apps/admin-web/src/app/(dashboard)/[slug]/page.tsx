"use client";

import { use } from "react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Group, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { canWriteOperational, canWriteTeaching, isTeacher } from "@/lib/permissions";
import {
  BellIcon,
  BriefcaseIcon,
  BuildingIcon,
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
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="text-[13px] font-medium text-[var(--color-text-muted)]">{title}</p>
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
          className="group mt-auto inline-flex items-center gap-0.5 pt-3 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
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
  });

  // O'qituvchida bu so'rov faqat unga biriktirilgan guruhlarni qaytaradi
  const groupsQuery = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: teacher,
  });

  if (orgQuery.isLoading) return <LoadingState rows={4} />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  const org = orgQuery.data;
  if (!org) return null;

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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {user?.branchName ?? org.name}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {isNetworkAdmin
              ? `/${org.slug}`
              : teacher
                ? `${org.name} · ${groupsQuery.data?.map((g) => g.name).join(", ") || "guruh biriktirilmagan"}`
                : org.name}
          </p>
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)]">Bugun · {todayLabel()}</p>
      </div>

      {summaryQuery.isError ? (
        <ErrorState message={(summaryQuery.error as Error).message} />
      ) : (
        <>
          {/* Tarmoq admini uchun tashkilotning o'zi haqidagi ma'lumot */}
          {isNetworkAdmin && (
            <section>
              <SectionTitle>Tashkilot</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  label="Filiallar"
                  value={org.branches.length}
                  icon={BuildingIcon}
                  href={`/${slug}/branches`}
                />
                <StatTile label="Bolalar" value={children} icon={ChildIcon} />
                <StatTile label="Xodimlar" value={employees} icon={TeacherIcon} />
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 py-3 shadow-[var(--shadow-card)]">
                  <div className="min-w-0">
                    <p className="text-[12px] leading-tight text-[var(--color-text-muted)]">Holat</p>
                    <Badge tone={org.status === "ACTIVE" ? "success" : "danger"} className="mt-0.5">
                      {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
                    </Badge>
                  </div>
                </div>
              </div>
            </section>
          )}

          {notStartedYet ? (
            <Card className="p-5">
              <p className="text-[17px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                {teacher ? "Hozircha ish yo'q" : "Boshlash uchun"}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
                {teacher
                  ? "Guruhlaringizda hali bola yo'q. Filial admini bolalarni ro'yxatga olgach, davomat va kundalik hisobot shu yerda paydo bo'ladi."
                  : "Bu filialda hali bola ro'yxatga olinmagan. Guruh ochib, bolalarni qo'shsangiz, davomat va kundalik hisobot shu yerda ko'rina boshlaydi."}
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
                  href={isNetworkAdmin ? undefined : `/${slug}/attendance`}
                  actionLabel={canTeach ? "Davomatni belgilash" : "Ko'rish"}
                />
                <TodayCard
                  title="Kundalik hisobot"
                  icon={NoteIcon}
                  done={summary?.todayDailyReportsFilled ?? 0}
                  total={children}
                  href={isNetworkAdmin ? undefined : `/${slug}/daily-reports`}
                  actionLabel={canTeach ? "To'ldirish" : "Ko'rish"}
                />
                {!teacher && (
                  <TodayCard
                    title="Xodimlar davomati"
                    icon={CalendarIcon}
                    done={staffMarked}
                    total={employees}
                    breakdown={[
                      { label: "Keldi", value: summary?.todayStaffAttendance.present ?? 0, tone: "success" },
                      { label: "Kelmadi", value: summary?.todayStaffAttendance.absent ?? 0, tone: "danger" },
                    ]}
                    href={isNetworkAdmin ? undefined : `/${slug}/staff-attendance`}
                    actionLabel={canWrite ? "Davomatni belgilash" : "Ko'rish"}
                  />
                )}
              </div>
            </section>
          )}

          {!teacher && (
          <section>
            <SectionTitle>Moliya</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-[13px] text-[var(--color-text-muted)]">Joriy oy tushumi</p>
                <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-[var(--color-success)]">
                  {formatMoney(summary?.monthRevenue ?? 0)}
                </p>
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
                {!isNetworkAdmin && debt > 0 && (
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
          )}

          {!isNetworkAdmin && !teacher && (
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
          )}

          {teacher && (
            <section>
              <SectionTitle>Mening guruhlarim</SectionTitle>
              {groupsQuery.data && groupsQuery.data.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupsQuery.data.map((group) => (
                    <Link
                      key={group.id}
                      href={`/${slug}/attendance`}
                      className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)] transition-all duration-[var(--dur-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:bg-[var(--color-surface-hover)] hover:shadow-[var(--shadow-raised)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <GroupIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-[var(--color-text)]">{group.name}</p>
                        <p className="text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                          {group._count?.children ?? 0} bola
                        </p>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]/50 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<GroupIcon className="h-[26px] w-[26px]" />}
                  title="Sizga hali guruh biriktirilmagan"
                  description="Filial admini guruh biriktirgach, shu yerda ko'rinadi."
                />
              )}
            </section>
          )}

          {!isNetworkAdmin && !teacher && (
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
          )}

          {/* Filiallar ro'yxati tarmoq darajasidagi ish — filialga biriktirilgan
              foydalanuvchi o'z filialidan boshqasini ko'rmasligi kerak. */}
          {isNetworkAdmin && (
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Filiallar</CardTitle>
                <Link
                  href={`/${slug}/branches`}
                  className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  Barchasi
                </Link>
              </CardHeader>
              <CardBody className="p-0">
                {org.branches.length === 0 ? (
                  // Kartochka ichida: bo'sh holat ramkasi karta chetiga
                  // yopishmasligi uchun kichik ichki bo'shliq qoldiriladi.
                  <div className="p-3">
                    <EmptyState icon={<BuildingIcon className="h-[26px] w-[26px]" />} title="Hali filial yo'q" />
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-separator)]">
                    {org.branches.slice(0, 5).map((branch) => (
                      <li key={branch.id}>
                        <Link
                          href={`/${slug}/branches/${branch.id}`}
                          className="group flex items-center gap-3 px-5 py-3 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-hover)] sm:px-6"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <BuildingIcon className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{branch.name}</p>
                            <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                              {branch.address || "Manzil ko'rsatilmagan"}
                            </p>
                          </div>
                          <span className="hidden text-[12.5px] tabular-nums text-[var(--color-text-muted)] sm:block">
                            {formatDate(branch.createdAt)}
                          </span>
                          <ChevronRightIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]/50 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
