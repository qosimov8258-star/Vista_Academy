"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePostLoginLoading } from "@/lib/post-login-loading";
import type { AnalyticsPeriod, DashboardAnalytics } from "@/lib/types";
import { ErrorState } from "@/components/ui/states";
import { CalendarIcon } from "@/components/ui/icons";
import { formatCompactMoney, formatDayMonth, formatMoney, formatNumber } from "@/lib/format";
import { Delta, KpiCard, PeriodSwitcher, PREVIOUS_LABEL } from "@/features/dashboard/kpi";
import { RevenueChart } from "@/features/dashboard/revenue-chart";
import { RenewalCalendar } from "@/features/dashboard/renewal-calendar";
import { ExpiringCard, RecentTransactions } from "@/features/dashboard/lists";

const PERIOD_STORAGE_KEY = "zeeron.dashboard.period";

function Placeholder({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-xl)] bg-[var(--color-surface)]/70 ${className}`} />;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("month");

  // Tanlangan davr shu brauzerda eslab qolinadi (qulaylik, majburiy emas)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
      if (saved === "day" || saved === "week" || saved === "month" || saved === "year") setPeriod(saved);
    } catch {
      // Maxfiy rejim yoki bloklangan saqlash — standart "Oy" qoladi
    }
  }, []);
  const changePeriod = (next: AnalyticsPeriod) => {
    setPeriod(next);
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, next);
    } catch {
      // e'tiborsiz
    }
  };

  const query = useQuery({
    queryKey: ["dashboard", "analytics", period],
    queryFn: () => api.get<DashboardAnalytics>(`/platform/dashboard/analytics?period=${period}`),
    placeholderData: keepPreviousData,
  });
  const { data, isLoading, isError, error, isFetching, refetch } = query;

  // Boshlang'ich ma'lumot tayyor bo'lgach (muvaffaqiyatli yoki xato bilan),
  // sign-in'dan keyin ko'rsatilgan global LoadingScreen'ni yashiramiz.
  const { stopPostLoginLoading } = usePostLoginLoading();
  useEffect(() => {
    if (!isLoading) stopPostLoginLoading();
  }, [isLoading, stopPostLoginLoading]);

  if (isError && !data) return <ErrorState message={(error as Error).message} />;

  const k = data?.kpis;
  const suffix = PREVIOUS_LABEL[period];
  const rangeEnd = data ? new Date(new Date(data.range.end).getTime() - 1) : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-text)]">Dashboard</h1>
          <p className="text-[13.5px] text-[var(--color-text-muted)]">Platforma bo&apos;ylab tushum, bog&apos;chalar va obunalar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSwitcher value={period} onChange={changePeriod} />
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-surface)] px-4 text-[13.5px] font-medium text-[var(--color-text)] shadow-[var(--shadow-card)]">
            <CalendarIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
            {data && rangeEnd
              ? period === "day"
                ? formatDayMonth(data.range.start)
                : `${formatDayMonth(data.range.start)} – ${formatDayMonth(rangeEnd)}`
              : "…"}
          </span>
        </div>
      </header>

      <section aria-label="Asosiy ko'rsatkichlar" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          dark
          label="Tushum"
          value={k ? formatCompactMoney(k.revenue.value) : ""}
          unit="so'm"
          loading={!k}
          footer={k && <Delta dark changePct={k.revenue.changePct} suffix={suffix} fallback={`oldingi davrda ${formatMoney(k.revenue.previous)}`} />}
        />
        <KpiCard
          label="Faol bolalar"
          value={k ? formatNumber(k.activeChildren.value) : ""}
          loading={!k}
          footer={
            k &&
            (k.activeChildren.added === 0 ? (
              <p className="text-[12.5px] text-[var(--color-text-muted)]">shu davrda yangi bola qo&apos;shilmadi</p>
            ) : (
              <Delta
                changePct={k.activeChildren.changePct}
                suffix={`shu davrda +${formatNumber(k.activeChildren.added)}`}
                fallback={`shu davrda +${formatNumber(k.activeChildren.added)}`}
              />
            ))
          }
        />
        <KpiCard
          label="Yangi bog'chalar"
          value={k ? formatNumber(k.newOrganizations.value) : ""}
          loading={!k}
          footer={k && <Delta changePct={k.newOrganizations.changePct} suffix={suffix} fallback={`oldingi davrda ${k.newOrganizations.previous} ta`} />}
        />
        <KpiCard
          label="MRR (oylik daromad)"
          value={k ? formatCompactMoney(k.mrr.value) : ""}
          unit="so'm"
          loading={!k}
          footer={k && <p className="text-[12.5px] text-[var(--color-text-muted)]">{k.mrr.activeSubscriptions} ta faol obuna</p>}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <RevenueChart data={data?.revenueByMonth ?? placeholderMonths()} loading={!data} />
        {data ? <RenewalCalendar data={data} /> : <Placeholder className="min-h-[340px]" />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        {data ? (
          <RecentTransactions items={data.recentTransactions} onRefresh={() => refetch()} refreshing={isFetching} />
        ) : (
          <Placeholder className="min-h-[320px]" />
        )}
        {data ? <ExpiringCard items={data.expiring} /> : <Placeholder className="min-h-[320px]" />}
      </div>
    </div>
  );
}

/** Ma'lumot kelguncha grafik skeleti uchun 12 ta bo'sh oy. */
function placeholderMonths() {
  return Array.from({ length: 12 }, (_, i) => ({ month: `0000-${String(i + 1).padStart(2, "0")}`, total: 0 }));
}
