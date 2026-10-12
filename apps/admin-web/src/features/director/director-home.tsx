"use client";

import Link from "next/link";
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, FinanceSummary, Organization, PaymentMethod } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
// Ikonkalar — lucide, Sabot veb paneli bilan bir xil to'plam
import {
  Baby,
  CakeSlice,
  CalendarX2,
  ChartColumn,
  ClipboardPen,
  FileClock,
  IdCard,
  Inbox,
  ReceiptText,
  RefreshCw,
  School,
  Settings,
  ShieldCheck,
  Syringe,
  TriangleAlert,
  UsersRound,
  Wallet,
} from "lucide-react";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosButton } from "@/components/ios/button";
import { Group, GroupLink, ListRow, Row } from "@/components/ios/group";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { GROUP_BLOCK, IOS, PAGE_CARD } from "@/components/ios/tokens";
import { IosIcon, type AnyIcon, type IosTint } from "./ios-icon";
import { compactMoney, fullMoney } from "./money";
import styles from "./director-home.module.css";
import { useTr } from "@/i18n/tr";

const TZ = "Asia/Tashkent";
export const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** Toshkent vaqti bo'yicha soat va sana — foydalanuvchi qaysi mintaqada bo'lishidan qat'i nazar */
export function tashkentNow() {
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

export function greeting(hour: number) {
  if (hour >= 5 && hour < 11) return "Xayrli tong";
  if (hour >= 11 && hour < 17) return "Xayrli kun";
  if (hour >= 17 && hour < 22) return "Xayrli kech";
  return "Xayrli tun";
}

/** Grafikdagi oylar soni */
const TREND_MONTHS = 6;

/** Joriy oydan orqaga `count` ta oy — eskisi birinchi ("2026-05" … "2026-10") */
function lastPeriods(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  BANK_TRANSFER: "O'tkazma",
  CARD: "Karta",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  MOBILE_APP: "Ilova orqali",
  BANKOMAT: "Bankomat",
  OTHER: "Boshqa",
};
const METHOD_COLOR: Record<PaymentMethod, string> = {
  CASH: IOS.green,
  BANK_TRANSFER: IOS.blue,
  CARD: "#5856d6",
  CLICK: "#30b0c7",
  PAYME: "#00c7be",
  UZUM: "#af52de",
  MOBILE_APP: IOS.orange,
  BANKOMAT: "#ff2d55",
  OTHER: IOS.gray,
};

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Bog'cha direktori (Super Admin) bosh sahifasi — dashboard, iOS grouped
 * uslubida (Sabot veb paneli bilan bir xil: `components/ios`, lucide).
 *
 * Hamma raqam mavjud API'lardan: tarmoq bo'yicha `summary`, har filialning
 * `summary?branchId=` (e'tibor ro'yxati, tug'ilgan kunlar, guruhlar to'lishi,
 * qarzdorlar — server ularni faqat filial kesimida beradi, shu yerda
 * yig'iladi) va oxirgi 6 oyning `finance/summary` si (tushum grafigi,
 * yig'ish foizi, to'lov usullari). Super Admin — kuzatuvchi, shuning uchun
 * havolalar faqat o'qish sahifalariga.
 */
export function DirectorHome({ slug, org }: { slug: string; org: Organization }) {
  const tr = useTr();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hour, date } = tashkentNow();
  const firstName = user?.fullName.split(" ")[0] ?? "";
  const periods = lastPeriods(date, TREND_MONTHS);
  const currentPeriod = periods[periods.length - 1];

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
  // Tarmoq moliyasi sahifasi bilan bir xil kalit
  const financeQueries = useQueries({
    queries: periods.map((period) => ({
      queryKey: ["finance-summary", slug, period],
      queryFn: () => api.get<FinanceSummary>(`/app/finance/summary?period=${period}`),
    })),
  });

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] }),
      queryClient.invalidateQueries({ queryKey: ["finance-summary", slug] }),
    ]);
    setRefreshing(false);
  };

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

  // ── Filiallar kesimidagi ma'lumotni tarmoq bo'yicha yig'ish ──
  const perBranch = org.branches.map((branch, i) => ({ branch, data: branchQueries[i]?.data }));
  const branchesLoading = branchQueries.some((q) => q.isLoading);
  const attention = {
    unmarked: perBranch.map(({ branch, data }) => ({ name: branch.name, n: data?.attention.unmarkedAttendance.length ?? 0 })),
    reports: perBranch.map(({ branch, data }) => ({ name: branch.name, n: data?.attention.missingDailyReport.length ?? 0 })),
    vaccines: perBranch.flatMap(({ branch, data }) => (data?.attention.overdueVaccinations ?? []).map((v) => ({ ...v, branch: branch.name }))),
  };
  const sumOf = (rows: { n: number }[]) => rows.reduce((a, r) => a + r.n, 0);
  const byBranch = (rows: { name: string; n: number }[]) =>
    rows.filter((r) => r.n > 0).map((r) => `${tr(r.name)} ${r.n}`).join(" · ");
  const debtors = perBranch
    .flatMap(({ branch, data }) => (data?.topDebtors ?? []).map((d) => ({ ...d, branch: branch.name })))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6);
  const birthdays = perBranch
    .flatMap(({ branch, data }) => (data?.upcomingBirthdays ?? []).map((b) => ({ ...b, branch: branch.name })))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6);
  const capacity = perBranch.reduce(
    (acc, { branch, data }) => {
      acc.total += data?.groupCapacity.totalCapacity ?? 0;
      acc.active += data?.groupCapacity.totalActive ?? 0;
      acc.groups.push(...(data?.groupCapacity.groups ?? []).map((g) => ({ ...g, branch: branch.name })));
      return acc;
    },
    { total: 0, active: 0, groups: [] as (DashboardSummary["groupCapacity"]["groups"][number] & { branch: string })[] },
  );
  const fullestGroups = [...capacity.groups].sort((a, b) => b.percent - a.percent).slice(0, 5);

  // ── Moliya: grafik, yig'ish foizi, to'lov usullari ──
  const finance = financeQueries.map((q) => q.data);
  const financeLoading = financeQueries.some((q) => q.isLoading);
  const trend = periods.map((period, i) => ({ period, amount: finance[i]?.totals.collectedInPeriod ?? 0 }));
  const current = finance[finance.length - 1];
  // To'lov usullari — oxirgi pul tushgan oy (joriy oy hali bo'sh bo'lishi mumkin)
  const methodsIndex = [...finance.keys()].reverse().find((i) => (finance[i]?.totals.collectedInPeriod ?? 0) > 0);
  const methodsMonth = methodsIndex !== undefined ? finance[methodsIndex] : undefined;
  const methods = methodsMonth
    ? (Object.entries(methodsMonth.byMethod) as [PaymentMethod, { amount: number; count: number }][])
        .filter(([, v]) => v.amount > 0)
        .sort((a, b) => b[1].amount - a[1].amount)
    : [];
  const methodsTotal = methods.reduce((a, [, v]) => a + v.amount, 0);
  const branchFinance = new Map((current?.branches ?? []).map((b) => [b.branchId, b]));
  const periodLabel = (period: string) => {
    const [y, m] = period.split("-").map(Number);
    return `${tr(MONTHS[m - 1])} ${y}`;
  };

  // Har bo'limning o'z tizim rangi — iOS Sozlamalaridagidek (filial admini bilan mos)
  const sections: { label: string; href: string; icon: AnyIcon; tint: IosTint }[] = [
    { label: "Filiallar", href: `/${slug}/branches`, icon: School, tint: "orange" },
    { label: "Guruhlar", href: `/${slug}/network/groups`, icon: UsersRound, tint: "indigo" },
    { label: "Bolalar", href: `/${slug}/network/children`, icon: Baby, tint: "blue" },
    { label: "Moliya", href: `/${slug}/network/finance`, icon: Wallet, tint: "green" },
    { label: "Hisobot", href: `/${slug}/report`, icon: ChartColumn, tint: "teal" },
    { label: "Xodimlar", href: `/${slug}/users`, icon: IdCard, tint: "purple" },
    { label: "Audit", href: `/${slug}/audit-logs`, icon: ShieldCheck, tint: "red" },
    { label: "Sozlamalar", href: `/${slug}/settings`, icon: Settings, tint: "gray" },
  ];

  const unmarkedTotal = sumOf(attention.unmarked);
  const reportsTotal = sumOf(attention.reports);

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <PageHeaderCard
          icon={School}
          tint="blue"
          title={tr(org.name)}
          count={tr("{0} ta filial", org.branches.length)}
          subtitle={
            <>
              {tr(WEEKDAYS[date.getUTCDay()])}, {date.getUTCDate()}-{tr(MONTHS[date.getUTCMonth()])} · {tr(greeting(hour))}
              {firstName && `, ${firstName}`}
            </>
          }
          actions={
            <>
              <IosButton label={tr("Yangilash")} icon={RefreshCw} compact onClick={refresh} loading={refreshing} />
              <IosButton label={tr("Hisobot")} icon={ChartColumn} variant="primary" compact href={`/${slug}/report`} />
            </>
          }
        />

        {org.status !== "ACTIVE" && (
          <div role="alert" className="flex items-center gap-3 rounded-[18px] bg-[#ff3b30]/[0.1] px-4 py-3 text-[14px] font-semibold text-[#ff3b30]">
            <TriangleAlert className="h-5 w-5 shrink-0" strokeWidth={2.2} />
            {tr("Tashkilot faoliyati to'xtatilgan")}
          </div>
        )}

        {/* ══ Asosiy ko'rsatkichlar ══ */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            href={`/${slug}/network/children`}
            icon={Baby}
            tint="blue"
            label={tr("Bolalar")}
            value={loading ? null : children}
            hint={tr("Bugun keldi: {0}", childrenPresent)}
            progress={pctOf(childrenPresent, children)}
            progressColor={IOS.green}
          />
          <KpiCard
            href={`/${slug}/users`}
            icon={IdCard}
            tint="purple"
            label={tr("Xodimlar")}
            value={loading ? null : employees}
            hint={tr("Bugun ishda: {0}", staffPresent)}
            progress={pctOf(staffPresent, employees)}
            progressColor={IOS.blue}
          />
          <KpiCard
            href={`/${slug}/network/finance`}
            icon={Wallet}
            tint="green"
            label={tr("Bu oy tushum")}
            value={loading ? null : compactMoney(revenue, tr)}
            valueTitle={fullMoney(revenue, tr)}
            pill={change !== null && <Pill color={change >= 0 ? IOS.green : IOS.red}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}%</Pill>}
            hint={change === null ? tr("O'tgan oy ma'lumoti yo'q") : tr("O'tgan oy: {0}", compactMoney(prevRevenue, tr))}
          />
          <KpiCard
            href={`/${slug}/network/finance`}
            icon={ReceiptText}
            tint={debt > 0 ? "red" : "gray"}
            label={tr("Qarzdorlik")}
            value={loading ? null : compactMoney(debt, tr)}
            valueTitle={fullMoney(debt, tr)}
            valueColor={debt > 0 ? IOS.red : undefined}
            hint={(s?.overdueInvoicesCount ?? 0) > 0 ? tr("{0} ta hisob muddati o'tgan", s?.overdueInvoicesCount ?? 0) : tr("Muddati o'tgan hisob yo'q")}
          />
        </div>

        {/* ══ Tushum dinamikasi + bugungi davomat ══ */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <Group
            title={tr("Tushum — oxirgi 6 oy")}
            refreshing={financeQueries.some((q) => q.isFetching) && !financeLoading}
            action={<GroupLink href={`/${slug}/network/finance`}>{tr("Moliya")}</GroupLink>}
            bare
          >
            <PageCard className="p-4 md:p-5">
              <RevenueChart data={trend} loading={financeLoading} label={periodLabel} />
              {/* Joriy oy: hisoblangan pulning qanchasi yig'ildi */}
              <div className="mt-4 border-t border-black/[0.06] pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] text-[var(--color-text)]">{tr("{0} — yig'ildi", periodLabel(currentPeriod))}</p>
                  <p className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">
                    {current && current.totals.billed > 0 ? `${pctOf(current.totals.collected, current.totals.billed)}%` : "—"}
                  </p>
                </div>
                <ProgressBar value={current ? pctOf(current.totals.collected, current.totals.billed) : 0} color={IOS.green} />
                <p className="mt-1.5 text-[13px] tabular-nums text-[#8e8e93]">
                  {current && current.totals.billed > 0
                    ? tr("{0} dan {1} yig'ildi · qoldi {2}", compactMoney(current.totals.billed, tr), compactMoney(current.totals.collected, tr), compactMoney(current.totals.outstanding, tr))
                    : tr("Bu oy uchun hali hisob yozilmagan")}
                </p>
              </div>
            </PageCard>
          </Group>

          <Group title={tr("Bugun bog'chada")} refreshing={summaryQuery.isFetching && !loading} bare>
            <PageCard className="p-4 md:p-5">
              <p className="px-1 text-[17px] font-semibold leading-snug text-[var(--color-text)]">
                {loading
                  ? tr("Yuklanmoqda…")
                  : !attendanceStarted
                    ? tr("Davomat hali belgilanmagan")
                    : tr("{0} boladan {1} tasi keldi", children, childrenPresent)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-black/[0.06]">
                <RingStat label={tr("Bolalar")} present={childrenPresent} absent={childrenAbsent} total={children} color={IOS.green} />
                <RingStat label={tr("Xodimlar")} present={staffPresent} absent={staffAbsent} total={employees} color={IOS.blue} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[13px]">
                <span className="text-[#8e8e93]">{tr("Kundalik hisobot to'ldirildi")}</span>
                <span className="font-semibold tabular-nums text-[var(--color-text)]">
                  {s?.todayDailyReportsFilled ?? 0} / {children}
                </span>
              </div>
            </PageCard>
          </Group>
        </div>

        {/* ══ E'tibor + qarzdorlar ══ */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 lg:items-start">
          <Group title={tr("E'tibor talab qiladi")} refreshing={branchesLoading && !loading}>
            <AttentionRow
              icon={CalendarX2}
              tint="orange"
              title={tr("Davomat belgilanmagan")}
              subtitle={byBranch(attention.unmarked) || tr("Hamma guruhlarda belgilangan")}
              count={unmarkedTotal}
              loading={branchesLoading}
              href={`/${slug}/network/children`}
            />
            <AttentionRow
              icon={ClipboardPen}
              tint="teal"
              title={tr("Kundalik hisobot to'ldirilmagan")}
              subtitle={byBranch(attention.reports) || tr("Hammasi to'ldirilgan")}
              count={reportsTotal}
              loading={branchesLoading}
              href={`/${slug}/network/children`}
            />
            <AttentionRow
              icon={Syringe}
              tint="pink"
              title={tr("Emlash muddati o'tgan")}
              subtitle={
                attention.vaccines.length > 0
                  ? attention.vaccines.slice(0, 2).map((v) => `${v.fullName} — ${tr(v.vaccineName)}`).join(" · ")
                  : tr("Muddati o'tgan emlash yo'q")
              }
              count={attention.vaccines.length}
              loading={branchesLoading}
              href={`/${slug}/network/children`}
            />
            <AttentionRow
              icon={FileClock}
              tint="red"
              title={tr("Muddati o'tgan hisoblar")}
              subtitle={tr("To'lov muddati o'tib ketgan, yopilmagan")}
              count={s?.overdueInvoicesCount ?? 0}
              loading={loading}
              href={`/${slug}/network/finance`}
            />
            <AttentionRow
              icon={Inbox}
              tint="green"
              title={tr("Yangi arizalar")}
              subtitle={tr("Hali ko'rib chiqilmagan murojaatlar")}
              count={s?.activeLeadsCount ?? 0}
              loading={loading}
              countColor={IOS.blue}
            />
          </Group>

          <Group
            title={tr("Eng katta qarzdorlar")}
            action={<GroupLink href={`/${slug}/network/finance`}>{tr("Barchasi")}</GroupLink>}
            bare
          >
            {branchesLoading ? (
              <SkeletonBlock rows={4} />
            ) : debtors.length === 0 ? (
              <EmptyBlock icon={ReceiptText} tint="green" title={tr("Qarzdor yo'q")} />
            ) : (
              <div className={GROUP_BLOCK}>
                {debtors.map((d) => (
                  <ListRow
                    key={d.childId}
                    href={`/${slug}/network/finance`}
                    avatar={<IosAvatar name={d.fullName} size={40} />}
                    title={d.fullName}
                    subtitle={tr(d.branch)}
                    meta={<span className="text-[15px] font-semibold tabular-nums" style={{ color: IOS.red }} title={fullMoney(d.balance, tr)}>{compactMoney(d.balance, tr)}</span>}
                    chevron
                  />
                ))}
              </div>
            )}
          </Group>
        </div>

        {/* ══ Filiallar + guruhlar to'lishi ══ */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <Group
            title={
              <>
                {tr("Filiallar")}
                {org.branches.length > 0 && <span className="font-normal normal-case tracking-normal">· {org.branches.length}</span>}
              </>
            }
            action={<GroupLink href={`/${slug}/branches`}>{tr("Barchasi")}</GroupLink>}
            bare
          >
            {org.branches.length === 0 ? (
              <div className={clsx(GROUP_BLOCK, "flex flex-col items-center px-6 py-9 text-center")}>
                <IosIcon icon={School} tint="orange" size={48} />
                <p className="mt-3 text-[15px] font-semibold text-[var(--color-text)]">{tr("Hali filial yo'q")}</p>
                <Link href={`/${slug}/branches`} className="mt-1.5 text-[15px] font-medium text-[var(--color-primary)] active:opacity-50">
                  {tr("Filial qo'shish")}
                </Link>
              </div>
            ) : (
              <div className={GROUP_BLOCK}>
                {perBranch.map(({ branch, data: b }) => {
                  const money = branchFinance.get(branch.id);
                  const rate = money && money.billed > 0 ? pctOf(money.collected, money.billed) : null;
                  return (
                    <ListRow
                      key={branch.id}
                      href={`/${slug}/${branch.slug}`}
                      avatar={<IosAvatar name={tr(branch.name)} letters={1} />}
                      title={tr(branch.name)}
                      subtitle={
                        b
                          ? tr("{0} bola · {1} guruh · {2} xodim", b.childrenCount, b.activeGroupsCount, b.employeesCount)
                          : branch.address || tr("Yuklanmoqda…")
                      }
                      meta={
                        b && (
                          <span className="flex items-center gap-2.5">
                            {/* Telefonda summa sig'maydi — u filial sahifasida ko'rinadi */}
                            <span className="hidden text-right sm:block">
                              <span className="block text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{compactMoney(b.monthRevenue, tr)}</span>
                              <span className="block text-[11.5px] text-[#8e8e93]">{tr("shu oy")}</span>
                            </span>
                            {rate !== null && (
                              <Pill color={rate >= 80 ? IOS.green : rate >= 50 ? IOS.orange : IOS.red} title={tr("Shu oy hisoblanganidan yig'ilgani")}>
                                {rate}%
                              </Pill>
                            )}
                          </span>
                        )
                      }
                      chevron
                    />
                  );
                })}
              </div>
            )}
          </Group>

          <Group title={tr("Guruhlar to'lishi")} action={<GroupLink href={`/${slug}/network/groups`}>{tr("Guruhlar")}</GroupLink>} bare>
            {branchesLoading ? (
              <SkeletonBlock rows={4} />
            ) : capacity.total === 0 ? (
              <EmptyBlock icon={UsersRound} tint="indigo" title={tr("Guruh sig'imi kiritilmagan")} />
            ) : (
              <PageCard className="p-4 md:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[28px] font-bold leading-none tabular-nums text-[var(--color-text)]">
                    {pctOf(capacity.active, capacity.total)}%
                  </p>
                  <p className="text-[13px] tabular-nums text-[#8e8e93]">{tr("{0} / {1} o'rin band", capacity.active, capacity.total)}</p>
                </div>
                <ProgressBar value={pctOf(capacity.active, capacity.total)} color={IOS.blue} />
                <ul className="mt-4 space-y-3">
                  {fullestGroups.map((g) => (
                    <li key={g.id}>
                      <div className="flex items-baseline justify-between gap-3 text-[14px]">
                        <span className="min-w-0 truncate text-[var(--color-text)]">{tr(g.name)}</span>
                        <span className="shrink-0 tabular-nums text-[#8e8e93]">
                          {g.active}/{g.capacity}
                        </span>
                      </div>
                      <p className="truncate text-[12px] text-[#8e8e93]">{tr(g.branch)}</p>
                      <ProgressBar value={g.percent} color={g.percent >= 100 ? IOS.red : g.percent >= 85 ? IOS.orange : IOS.green} thin />
                    </li>
                  ))}
                </ul>
              </PageCard>
            )}
          </Group>
        </div>

        {/* ══ Tug'ilgan kunlar · to'lov usullari · bo'limlar ══ */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 md:items-start xl:grid-cols-3">
          <Group title={tr("Yaqin tug'ilgan kunlar")} bare>
            {branchesLoading ? (
              <SkeletonBlock rows={3} />
            ) : birthdays.length === 0 ? (
              <EmptyBlock icon={CakeSlice} tint="pink" title={tr("Bir hafta ichida tug'ilgan kun yo'q")} />
            ) : (
              <div className={GROUP_BLOCK}>
                {birthdays.map((b) => {
                  // Necha yoshga to'ladi — keyingi tug'ilgan kun yili minus tug'ilgan yil
                  const next = new Date(date.getTime() + b.daysUntil * 86_400_000);
                  const age = next.getUTCFullYear() - new Date(b.birthDate).getUTCFullYear();
                  return (
                    <ListRow
                      key={b.childId}
                      avatar={<IosIcon icon={CakeSlice} tint={b.daysUntil <= 1 ? "pink" : "gray"} size={40} />}
                      title={b.fullName}
                      // Muddat izohda — tor ustunda ism qirqilib qolmasin
                      subtitle={
                        <>
                          <span className={clsx(b.daysUntil <= 1 && "font-semibold")} style={b.daysUntil <= 1 ? { color: b.daysUntil === 0 ? IOS.green : IOS.orange } : undefined}>
                            {b.daysUntil === 0 ? tr("Bugun") : b.daysUntil === 1 ? tr("Ertaga") : tr("{0} kundan keyin", b.daysUntil)}
                          </span>
                          {` · ${tr("{0} yoshga to'ladi", age)} · ${tr(b.branch)}`}
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
          </Group>

          <Group title={tr("To'lov usullari")} footer={methodsMonth ? periodLabel(methodsMonth.period) : undefined} bare>
            {financeLoading ? (
              <SkeletonBlock rows={3} avatar={false} />
            ) : methods.length === 0 ? (
              <EmptyBlock icon={Wallet} tint="green" title={tr("Hali to'lov kelmagan")} />
            ) : (
              <PageCard className="p-4 md:p-5">
                {/* Ulushlar — bitta chiziqda */}
                <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
                  {methods.map(([m, v]) => (
                    <span key={m} className="h-full" style={{ width: `${(v.amount / methodsTotal) * 100}%`, backgroundColor: METHOD_COLOR[m] }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {methods.map(([m, v]) => (
                    <li key={m} className="flex items-center gap-2.5 text-[14px]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: METHOD_COLOR[m] }} />
                      <span className="min-w-0 flex-1 truncate text-[var(--color-text)]">
                        {tr(METHOD_LABEL[m])}
                        <span className="ml-1.5 text-[12.5px] text-[#8e8e93]">{tr("{0} ta", v.count)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[#8e8e93]">{pctOf(v.amount, methodsTotal)}%</span>
                      <span className="w-[76px] shrink-0 text-right font-semibold tabular-nums text-[var(--color-text)]" title={fullMoney(v.amount, tr)}>
                        {compactMoney(v.amount, tr)}
                      </span>
                    </li>
                  ))}
                </ul>
              </PageCard>
            )}
          </Group>

          <Group title={tr("Bo'limlar")} className="md:col-span-2 xl:col-span-1">
            {sections.map((section) => (
              <Row key={section.href} href={section.href} leading={<IosIcon icon={section.icon} tint={section.tint} size={30} />} title={tr(section.label)} />
            ))}
          </Group>
        </div>
      </div>
    </div>
  );
}

/** Asosiy ko'rsatkich kartasi: plitka va nom, katta qiymat, izoh va ixtiyoriy ingichka chiziq */
function KpiCard({
  href,
  icon,
  tint,
  label,
  value,
  valueTitle,
  valueColor,
  pill,
  hint,
  progress,
  progressColor,
}: {
  href: string;
  icon: AnyIcon;
  tint: IosTint;
  label: string;
  /** `null` — yuklanmoqda */
  value: ReactNode | null;
  valueTitle?: string;
  valueColor?: string;
  pill?: ReactNode;
  hint: string;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <Link href={href} className={clsx(PAGE_CARD, "flex min-w-0 flex-col p-4 transition-transform active:scale-[0.99]")}>
      <div className="flex items-center gap-2.5">
        <IosIcon icon={icon} tint={tint} size={30} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#6d6d72]">{label}</span>
      </div>
      {/* Kapsula qiymat yonida — nom tor kartada qirqilib qolmasin */}
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: valueColor ?? "var(--color-text)" }} title={valueTitle}>
          {value === null ? <span className="inline-block h-7 w-16 animate-pulse rounded-lg bg-[#767680]/[0.12] align-middle" /> : value}
        </p>
        {pill}
      </div>
      <p className="mt-1.5 truncate text-[12.5px] text-[#8e8e93]">{hint}</p>
      {progress !== undefined && <ProgressBar value={progress} color={progressColor ?? IOS.green} thin />}
    </Link>
  );
}

/** E'tibor qatori: plitka, nom va izoh, o'ngda soni (0 bo'lsa kulrang, bo'lmasa to'q sariq) */
function AttentionRow({
  icon,
  tint,
  title,
  subtitle,
  count,
  loading,
  href,
  countColor,
}: {
  icon: AnyIcon;
  tint: IosTint;
  title: string;
  subtitle: string;
  count: number;
  loading?: boolean;
  href?: string;
  countColor?: string;
}) {
  return (
    <Row
      href={href}
      leading={<IosIcon icon={icon} tint={tint} size={30} />}
      title={title}
      subtitle={subtitle}
      value={
        loading ? (
          <span className="inline-block h-4 w-6 animate-pulse rounded bg-[#767680]/[0.12] align-middle" />
        ) : count > 0 ? (
          <span className="font-semibold" style={{ color: countColor ?? IOS.orange }}>{count}</span>
        ) : (
          <span>0</span>
        )
      }
    />
  );
}

/** 6 oylik ustunli grafik — joriy oy tizim rangida, qolganlari och; qiymat ustun tepasida */
function RevenueChart({ data, loading, label }: { data: { period: string; amount: number }[]; loading: boolean; label: (p: string) => string }) {
  const tr = useTr();
  const max = Math.max(...data.map((d) => d.amount), 1);
  const empty = data.every((d) => d.amount === 0);
  return (
    <div>
      <div className="relative flex h-[168px] items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const last = i === data.length - 1;
          const h = loading ? 30 + ((i * 17) % 50) : d.amount > 0 ? Math.max(6, (d.amount / max) * 100) : 3;
          return (
            <div key={d.period} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${label(d.period)}: ${fullMoney(d.amount, tr)}`}>
              {!loading && d.amount > 0 && (
                <span className="truncate text-[11.5px] font-semibold tabular-nums text-[#6d6d72]">{compactMoney(d.amount, tr)}</span>
              )}
              <span
                className={clsx("w-full max-w-[56px] rounded-[8px]", loading && "animate-pulse", styles.bar)}
                style={{
                  height: `${h}%`,
                  backgroundColor: loading || d.amount === 0 ? "#767680" : "var(--color-primary)",
                  opacity: loading || d.amount === 0 ? 0.12 : last ? 1 : 0.35,
                }}
              />
            </div>
          );
        })}
        {!loading && empty && (
          <p className="absolute inset-x-0 top-1/3 text-center text-[13px] text-[#8e8e93]">{tr("Oxirgi 6 oyda to'lov kelmagan")}</p>
        )}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <span key={d.period} className={clsx("min-w-0 flex-1 truncate text-center text-[12px]", i === data.length - 1 ? "font-semibold text-[var(--color-text)]" : "text-[#8e8e93]")}>
            {shortMonth(label(d.period))}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Grafik ostidagi oy: 3 harf; o'zbekcha iyun/iyul ikkalasi «iyu» bo'lib qolmasin */
function shortMonth(label: string) {
  const name = label.split(" ")[0];
  if (name === "iyun") return "iyn";
  if (name === "iyul") return "iyl";
  return name.slice(0, 3);
}

function ProgressBar({ value, color, thin = false }: { value: number; color: string; thin?: boolean }) {
  return (
    <div className={clsx("mt-2 w-full overflow-hidden rounded-full bg-[#767680]/[0.12]", thin ? "h-1.5" : "h-2")} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
    </div>
  );
}

function SkeletonBlock({ rows, avatar = true }: { rows: number; avatar?: boolean }) {
  return (
    <div className={GROUP_BLOCK} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
          {avatar && <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#767680]/[0.12]" />}
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/5 animate-pulse rounded-full bg-[#767680]/[0.12]" />
            <span className="block h-3 w-3/5 animate-pulse rounded-full bg-[#767680]/[0.08]" />
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ icon, tint, title }: { icon: AnyIcon; tint: IosTint; title: string }) {
  return (
    <div className={clsx(GROUP_BLOCK, "flex flex-col items-center px-6 py-8 text-center")}>
      <IosIcon icon={icon} tint={tint} size={40} />
      <p className="mt-3 text-[15px] font-medium text-[var(--color-text)]">{title}</p>
    </div>
  );
}

/** Apple Watch halqasi kabi: keldi — to'liq rang, kelmadi — xira qizil, belgilanmagan — bo'sh */
function RingStat({ label, present, absent, total, color }: { label: string; present: number; absent: number; total: number; color: string }) {
  const tr = useTr();
  const size = 88;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, present / total) : 0;
  const absentPct = total > 0 ? Math.min(1 - pct, absent / total) : 0;
  return (
    <div className="flex min-w-0 flex-col items-center bg-[#f2f2f7] px-3 py-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#767680" strokeOpacity={0.14} strokeWidth={stroke} />
          {absentPct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={IOS.red}
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
          <span className="text-[20px] font-bold leading-none tabular-nums text-[var(--color-text)]">{tr(present)}</span>
          <span className="mt-0.5 text-[12px] font-medium tabular-nums text-[#8e8e93]">/ {tr(total)}</span>
        </div>
      </div>
      <p className="mt-2 text-[14px] font-semibold text-[var(--color-text)]">{label}</p>
      <p className="text-[12px] text-[#8e8e93]">
        {absent > 0 ? tr("{0} kelmadi", absent) : total > 0 && present === 0 ? tr("belgilanmagan") : tr("keldi")}
      </p>
    </div>
  );
}
