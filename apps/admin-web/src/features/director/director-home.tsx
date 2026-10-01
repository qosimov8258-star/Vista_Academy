"use client";

import Link from "next/link";
import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import type { IconProps } from "@/components/ui/icons";
import {
  AuditIcon,
  BuildingIcon,
  ChartIcon,
  ChevronRightIcon,
  ChildIcon,
  GroupIcon,
  MoneyIcon,
  SettingsIcon,
  TeacherIcon,
} from "@/components/ui/icons";
import { IosIcon, type IosTint } from "./ios-icon";
import { compactMoney, fullMoney } from "./money";
import styles from "./director-home.module.css";
import { useTr } from "@/i18n/tr";

const TZ = "Asia/Tashkent";
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** Toshkent vaqti bo'yicha soat va sana — foydalanuvchi qaysi mintaqada bo'lishidan qat'i nazar */
function tashkentNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const date = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  return { hour: get("hour"), date };
}

function greeting(hour: number) {
  if (hour >= 5 && hour < 11) return "Xayrli tong";
  if (hour >= 11 && hour < 17) return "Xayrli kun";
  if (hour >= 17 && hour < 22) return "Xayrli kech";
  return "Xayrli tun";
}

/**
 * Bog'cha direktori (Super Admin) bosh sahifasi — iOS uslubida: katta
 * sarlavha, yumaloq vidjetlar, tizim rangidagi "squircle" ikonkalar, guruhlangan
 * ro'yxat va iPhone bosh ekranidagidek tezkor bo'limlar. Telefonda ilova
 * kabi ko'rinadi.
 */
export function DirectorHome({ slug, org }: { slug: string; org: Organization }) {
  const tr = useTr();
  const { user } = useAuth();
  const { hour, date } = tashkentNow();
  const firstName = user?.fullName.split(" ")[0] ?? "";

  // Bosh sahifadagi umumiy so'rov bilan bir xil kalit — qayta yuklanmaydi
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug],
    queryFn: () => api.get<DashboardSummary>("/app/dashboard/summary"),
  });
  // Filiallar sahifasi bilan bir xil kalitlar — o'tganda ma'lumot tayyor turadi
  const branchQueries = useQueries({
    queries: org.branches.map((branch) => ({
      queryKey: ["dashboard-summary", slug, branch.id],
      queryFn: () => api.get<DashboardSummary>(`/app/dashboard/summary?branchId=${branch.id}`),
    })),
  });

  const s = summaryQuery.data;
  const loading = summaryQuery.isLoading;
  const children = s?.childrenCount ?? 0;
  const employees = s?.employeesCount ?? 0;
  const childrenPresent = s?.todayAttendance.present ?? 0;
  const childrenAbsent = s?.todayAttendance.absent ?? 0;
  const staffPresent = s?.todayStaffAttendance.present ?? 0;
  const staffAbsent = s?.todayStaffAttendance.absent ?? 0;
  const revenue = s?.monthRevenue ?? 0;
  const prevRevenue = s?.previousMonthRevenue ?? 0;
  const debt = s?.outstandingDebt ?? 0;
  const change = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  const attendanceStarted = childrenPresent + childrenAbsent + staffPresent + staffAbsent > 0;

  const apps: { label: string; href: string; icon: ComponentType<IconProps>; tint: IosTint }[] = [
    { label: "Filiallar", href: `/${slug}/branches`, icon: BuildingIcon, tint: "accent" },
    { label: "Guruhlar", href: `/${slug}/network/groups`, icon: GroupIcon, tint: "accent" },
    { label: "Bolalar", href: `/${slug}/network/children`, icon: ChildIcon, tint: "accent" },
    { label: "Moliya", href: `/${slug}/network/finance`, icon: MoneyIcon, tint: "accent" },
    { label: "Hisobot", href: `/${slug}/report`, icon: ChartIcon, tint: "accent" },
    { label: "Xodimlar", href: `/${slug}/users`, icon: TeacherIcon, tint: "accent" },
    { label: "Audit", href: `/${slug}/audit-logs`, icon: AuditIcon, tint: "accent" },
    { label: "Sozlamalar", href: `/${slug}/settings`, icon: SettingsIcon, tint: "accent" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-7 pb-4 md:space-y-8">
      {/* Katta sarlavha — iOS "Large Title" */}
      <header className={styles.rise}>
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {tr(WEEKDAYS[date.getUTCDay()])}, {date.getUTCDate()}-{tr(MONTHS[date.getUTCMonth()])}
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--color-text)] md:text-[34px]">
          {greeting(hour)}
          {firstName && `, ${firstName}`}
        </h1>
        {org.status !== "ACTIVE" && (
          <p className="mt-3 inline-flex rounded-full bg-[var(--color-danger-bg)] px-3 py-1 text-[13px] font-semibold text-[var(--color-danger)]">
            {tr("Tashkilot faoliyati to'xtatilgan")}
          </p>
        )}
      </header>

      {/* Bugun — davomat halqalari */}
      <section className={clsx(styles.hero, styles.rise, "relative overflow-hidden rounded-[var(--radius-xl)] p-5 md:p-7")} style={{ animationDelay: "40ms" }}>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[340px]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{tr("Bugun bog'chada")}</p>
            <p className="mt-2 text-[22px] font-bold leading-snug tracking-[-0.015em] text-[var(--color-text)] md:text-[26px]">
              {loading
                ? "Yuklanmoqda…"
                : !attendanceStarted
                  ? tr("Davomat hali belgilanmagan")
                  : tr("{0} boladan {1} tasi keldi", children, childrenPresent)}
            </p>
            <p className="mt-1.5 text-[14px] text-[var(--color-text-muted)]">
              {tr(org.branches.length)} {tr("ta filial ·")}{" "}{children} {tr("bola ·")}{" "}{tr(employees)} {tr("xodim")}
            </p>
          </div>

          <div className="flex gap-3 md:gap-4">
            <RingStat label={tr("Bolalar")} present={childrenPresent} absent={childrenAbsent} total={children} color="var(--color-primary)" />
            <RingStat label={tr("Xodimlar")} present={staffPresent} absent={staffAbsent} total={employees} color="var(--accent-bright)" />
          </div>
        </div>
      </section>

      {/* Raqamlar — vidjetlar */}
      <section className={clsx(styles.rise, "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4")} style={{ animationDelay: "80ms" }}>
        <Widget href={`/${slug}/branches`} icon={BuildingIcon} tint="accent" label={tr("Filiallar")} value={org.branches.length} />
        <Widget href={`/${slug}/network/children`} icon={ChildIcon} tint="accent" label={tr("Bolalar")} value={children} loading={loading} />
        <Widget href={`/${slug}/network/groups`} icon={GroupIcon} tint="accent" label={tr("Faol guruhlar")} value={s?.activeGroupsCount ?? 0} loading={loading} />
        <Widget href={`/${slug}/users`} icon={TeacherIcon} tint="accent" label={tr("Xodimlar")} value={employees} loading={loading} />
      </section>

      {/* Moliya */}
      <section className={styles.rise} style={{ animationDelay: "120ms" }}>
        <SectionHeader title={tr("Moliya")} href={`/${slug}/network/finance`} />
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <Link href={`/${slug}/network/finance`} className={clsx(styles.card, "group block p-5")}>
            <div className="flex items-center gap-3">
              <IosIcon icon={MoneyIcon} tint="accent" size={36} />
              <p className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Joriy oy tushumi")}</p>
              {change !== null && (
                <span
                  className={clsx(
                    "ml-auto rounded-full px-2.5 py-1 text-[12.5px] font-bold tabular-nums",
                    change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                  )}
                >
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
                </span>
              )}
            </div>
            <p className="mt-4 text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]" title={fullMoney(revenue, tr)}>
              {loading ? "—" : compactMoney(revenue, tr)}
              <span className="ml-1.5 text-[16px] font-semibold text-[var(--color-text-muted)]">{tr("so'm")}</span>
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
              {change === null ? tr("O'tgan oy bilan solishtirish uchun ma'lumot yo'q") : tr("O'tgan oy: {0} so'm", compactMoney(prevRevenue, tr))}
            </p>
          </Link>

          <Link href={`/${slug}/network/finance`} className={clsx(styles.card, "group block p-5")}>
            <div className="flex items-center gap-3">
              <IosIcon icon={MoneyIcon} tint={debt > 0 ? "red" : "gray"} size={36} />
              <p className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Qarzdorlik")}</p>
              {debt > 0 && <span className="ml-auto rounded-full bg-rose-50 px-2.5 py-1 text-[12.5px] font-bold text-rose-700">{tr("To'lanishi kerak")}</span>}
            </div>
            <p
              className={clsx(
                "mt-4 text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums",
                debt > 0 ? "text-[#e8392f]" : "text-[var(--color-text)]",
              )}
              title={fullMoney(debt, tr)}
            >
              {loading ? "—" : compactMoney(debt, tr)}
              <span className="ml-1.5 text-[16px] font-semibold text-[var(--color-text-muted)]">{tr("so'm")}</span>
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">{debt > 0 ? tr("Barcha filiallar bo'yicha to'lanmagan qoldiq") : tr("Qarzdor yo'q")}</p>
          </Link>
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
        {/* Filiallar — iOS guruhlangan ro'yxat */}
        <section className={styles.rise} style={{ animationDelay: "160ms" }}>
          <SectionHeader title={tr("Filiallar")} href={`/${slug}/branches`} />
          {org.branches.length === 0 ? (
            <div className={clsx(styles.card, "flex flex-col items-center px-6 py-10 text-center")}>
              <IosIcon icon={BuildingIcon} tint="accent" size={52} />
              <p className="mt-4 text-[16px] font-semibold text-[var(--color-text)]">{tr("Hali filial yo'q")}</p>
              <Link href={`/${slug}/branches`} className="mt-2 text-[14px] font-semibold text-[var(--color-primary)]">
                {tr("Filial qo'shish")}
              </Link>
            </div>
          ) : (
            <ul className={clsx(styles.card, "overflow-hidden")}>
              {org.branches.map((branch, i) => {
                const b = branchQueries[i]?.data;
                return (
                  <li key={branch.id}>
                    <Link
                      href={`/${slug}/${branch.slug}`}
                      className="group relative flex items-center gap-3.5 px-4 py-3.5 transition-colors active:bg-black/[0.04] md:hover:bg-black/[0.025]"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[var(--accent-soft)] text-[17px] font-bold text-[var(--accent-soft-icon)] ring-1 ring-inset ring-[var(--accent-soft-icon)]/10">
                        {branch.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold text-[var(--color-text)]">{tr(branch.name)}</p>
                        <p className="truncate text-[13px] text-[var(--color-text-muted)]">
                          {b ? tr("{0} bola · {1} guruh · {2} xodim", b.childrenCount, b.activeGroupsCount, b.employeesCount) : (branch.address || "Yuklanmoqda…")}
                        </p>
                      </div>
                      {b && (
                        <span className="hidden text-right sm:block">
                          <span className="block text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{compactMoney(b.monthRevenue, tr)}</span>
                          <span className="block text-[11.5px] text-[var(--color-text-muted)]">{tr("shu oy")}</span>
                        </span>
                      )}
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c4c4c7]" />
                      {i > 0 && <span className="absolute left-[76px] right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tezkor bo'limlar — iPhone bosh ekranidagidek */}
        <section className={styles.rise} style={{ animationDelay: "200ms" }}>
          <SectionHeader title={tr("Bo'limlar")} />
          <div className={clsx(styles.card, "grid grid-cols-4 gap-y-5 px-2 py-5")}>
            {apps.map((app) => (
              <Link key={app.href} href={app.href} className={clsx(styles.app, "flex flex-col items-center gap-2 px-1")}>
                <IosIcon icon={app.icon} tint={app.tint} size={54} />
                <span className="w-full truncate text-center text-[12px] font-medium text-[var(--color-text)]">{tr(app.label)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  const tr = useTr();
  return (
    <div className="mb-3 flex items-end justify-between px-1">
      <h2 className="text-[21px] font-bold tracking-[-0.02em] text-[var(--color-text)]">{tr(title)}</h2>
      {href && (
        <Link href={href} className="text-[15px] font-medium text-[var(--color-primary)] active:opacity-60">
          {tr("Barchasi")}
        </Link>
      )}
    </div>
  );
}

function Widget({
  href,
  icon,
  tint,
  label,
  value,
  loading,
}: {
  href: string;
  icon: ComponentType<IconProps>;
  tint: IosTint;
  label: string;
  value: ReactNode;
  loading?: boolean;
}) {
  const tr = useTr();
  return (
    <Link href={href} className={clsx(styles.card, "group flex flex-col p-4 md:p-5")}>
      <div className="flex items-start justify-between">
        <IosIcon icon={icon} tint={tint} size={40} />
        <ChevronRightIcon className="h-4 w-4 text-[#c4c4c7] transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-4 text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]">
        {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded-lg bg-[var(--color-surface-sunken)] align-middle" /> : value}
      </p>
      <p className="mt-1.5 text-[14px] font-medium text-[var(--color-text-muted)]">{tr(label)}</p>
    </Link>
  );
}

/** Apple Watch halqasi kabi: keldi — to'liq rang, kelmadi — xira, belgilanmagan — bo'sh */
function RingStat({ label, present, absent, total, color }: { label: string; present: number; absent: number; total: number; color: string }) {
  const tr = useTr();
  const size = 104;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, present / total) : 0;
  const absentPct = total > 0 ? Math.min(1 - pct, absent / total) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-3 py-4 md:w-[150px] md:flex-none">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border-hair)" strokeWidth={stroke} />
          {absentPct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--color-danger)"
              strokeOpacity={0.5}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${absentPct * c} ${c}`}
              strokeDashoffset={-pct * c}
              className={styles.ring}
            />
          )}
          {pct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${pct * c} ${c}`}
              className={styles.ring}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold leading-none tabular-nums text-[var(--color-text)]">{tr(present)}</span>
          <span className="mt-0.5 text-[12px] font-medium text-[var(--color-text-muted)]">/ {tr(total)}</span>
        </div>
      </div>
      <p className="mt-2.5 text-[14px] font-semibold text-[var(--color-text)]">{tr(label)}</p>
      <p className="text-[12px] text-[var(--color-text-muted)]">{absent > 0 ? `${absent} kelmadi` : total > 0 && present === 0 ? "belgilanmagan" : "keldi"}</p>
    </div>
  );
}
