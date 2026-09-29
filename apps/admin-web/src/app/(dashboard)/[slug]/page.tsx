"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinanceChildren, FinanceChildStatus, FinanceSummary, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatMoney, formatChildId } from "@/lib/format";
import { isChef, isTeacher } from "@/lib/permissions";
import { isCashierPosition } from "@/lib/employee-position";
import { ChefHome } from "@/features/nutrition/chef-home";
import { CashierHome } from "@/features/cash/cashier-home";
import { AdminHome } from "@/features/desk/admin-home";
import { DirectorHome } from "@/features/director/director-home";
import { TeacherHome } from "@/features/teacher/teacher-home";
import { ChildIcon, MoneyIcon } from "@/components/ui/icons";
import { PeriodPicker } from "@/features/network/period-picker";
import { IosIcon } from "@/features/director/ios-icon";
import { formatCompact, formatSum } from "@/features/network/money";
import clsx from "clsx";
import styles from "./page.module.css";

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

/** "2026-09" -> "sentabr 2026" (Toshkent vaqti bo'yicha joriy oy). */
function currentPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

const STATUS_META: Record<FinanceChildStatus, { label: string; color: string }> = {
  PAID: { label: "To'liq to'lagan", color: "var(--color-success)" },
  PARTIAL: { label: "Yarim to'lagan", color: "var(--color-warning)" },
  UNPAID: { label: "To'lamagan", color: "var(--color-danger)" },
};

const STATUS_ORDER: FinanceChildStatus[] = ["PAID", "PARTIAL", "UNPAID"];

/** Doira ustidagi `angleDeg` nuqtaning (soat 12 dan boshlab, soat yo'nalishida) koordinatasi. */
function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/**
 * To'lov holati bo'yicha bitta katta doiraviy diagramma (pie chart): to'liq
 * to'lagan — yashil, yarim to'lagan — sariq, to'lamagan — qizil, har biri
 * ulushiga mos foiz bilan. Pastidagi ro'yxat bosilsa shu holatdagi
 * o'quvchilar ro'yxati ochiladi — avvalgi alohida kartalardagi xatti-harakat
 * shu yerga ko'chdi.
 */
function PaymentStatusPie({
  counts,
  openStatus,
  onToggle,
}: {
  counts: { total: number; paid: number; partial: number; unpaid: number };
  openStatus: FinanceChildStatus | null;
  onToggle: (status: FinanceChildStatus) => void;
}) {
  const size = 232;
  const center = size / 2;
  const radius = center - 3;
  const total = counts.total;

  let angle = 0;
  const slices = STATUS_ORDER.map((status) => {
    const value = status === "PAID" ? counts.paid : status === "PARTIAL" ? counts.partial : counts.unpaid;
    const fraction = total > 0 ? value / total : 0;
    const startAngle = angle;
    angle += fraction * 360;
    return { status, value, fraction, startAngle, endAngle: angle };
  });

  return (
    <Card className="flex flex-col items-center gap-7 p-6 sm:flex-row sm:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0 ? (
            <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border-hair)" strokeWidth={4} />
          ) : (
            slices.map((slice, i) => {
              if (slice.fraction <= 0) return null;
              const full = slice.fraction >= 0.999;
              const start = polarPoint(center, center, radius, slice.startAngle);
              const end = polarPoint(center, center, radius, slice.endAngle);
              const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
              const d = full
                ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center} ${center + radius} A ${radius} ${radius} 0 1 1 ${center} ${center - radius} Z`
                : `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
              return (
                <path
                  key={slice.status}
                  d={d}
                  fill={STATUS_META[slice.status].color}
                  stroke="var(--color-surface)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  opacity={openStatus && openStatus !== slice.status ? 0.35 : 1}
                  className={clsx(styles.slice, "transition-opacity duration-300")}
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              );
            })
          )}
        </svg>
        {total === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
            <span className="text-[13px] font-medium text-[var(--color-text-muted)]">Bu davrda hisob-faktura yo&apos;q</span>
          </div>
        ) : (
          slices.map((slice) => {
            if (slice.fraction < 0.06) return null;
            const mid = (slice.startAngle + slice.endAngle) / 2;
            const pos = polarPoint(center, center, radius * 0.62, mid);
            return (
              <span
                key={slice.status}
                className="pointer-events-none absolute text-[15px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]"
                style={{ left: pos.x, top: pos.y, transform: "translate(-50%, -50%)" }}
              >
                {Math.round(slice.fraction * 100)}%
              </span>
            );
          })
        )}
      </div>

      <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[230px]">
        {slices.map((slice) => (
          <button
            key={slice.status}
            type="button"
            onClick={() => onToggle(slice.status)}
            aria-pressed={openStatus === slice.status}
            className={clsx(
              "flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left transition-colors",
              openStatus === slice.status
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                : "border-transparent hover:bg-[var(--color-surface-sunken)]",
            )}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS_META[slice.status].color }} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--color-text)]">
              {STATUS_META[slice.status].label}
            </span>
            <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-[var(--color-text)]">
              {slice.value}
              <span className="ml-1 font-normal text-[var(--color-text-muted)]">({Math.round(slice.fraction * 100)}%)</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/**
 * Bu oy davomida haftalar kesimida qancha to'lov tushganini ko'rsatadigan
 * ustunli grafik — bosh sahifada qaysi haftada tushum ko'tarilib-pasayganini
 * bir qarashda ko'rsatish uchun.
 */
function WeeklyPaymentsChart({ weeks, periodText }: { weeks: FinanceSummary["weeklyPayments"]; periodText: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.amount));

  return (
    <Card className="p-5">
      <p className="text-[15px] font-semibold text-[var(--color-text)]">To&apos;lovlar — hafta bo&apos;yicha</p>
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{periodText}, qaysi haftada qancha tushgani</p>
      <div className="mt-5 flex items-end gap-3 sm:gap-5">
        {weeks.map((week, i) => {
          const heightPct = Math.max(week.amount > 0 ? 6 : 2, (week.amount / max) * 100);
          return (
            <div key={week.week} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                {week.amount > 0 ? formatCompact(week.amount) : "—"}
              </span>
              <div
                className="relative flex h-[110px] w-full items-end justify-center"
                tabIndex={0}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              >
                {hovered === i && (
                  <div className="absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-[10px] bg-[var(--color-text)] px-2.5 py-1.5 text-center shadow-[var(--shadow-raised)]">
                    <span className="block text-[12px] font-bold text-[var(--color-surface)]">{formatSum(week.amount)} so&apos;m</span>
                    <span className="block text-[11px] text-[var(--color-surface)]/70">{week.count} ta to&apos;lov</span>
                  </div>
                )}
                <div
                  className={clsx(
                    "w-full max-w-[24px] rounded-t-[4px] bg-[var(--color-primary)] transition-[height,opacity] duration-300 ease-[var(--ease-out)]",
                    hovered === i ? "opacity-100" : "opacity-85",
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[11.5px] font-medium text-[var(--color-text-muted)]">{week.week}-hafta</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";
  const teacher = isTeacher(user?.role);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const [period, setPeriod] = useState<string | null>(null);
  useEffect(() => {
    setPeriod((current) => current ?? currentPeriod());
  }, []);

  const financeQuery = useQuery({
    queryKey: ["dashboard-finance-children", slug, period],
    queryFn: () => api.get<FinanceChildren>(`/app/finance/children?period=${period}`),
    // Oshpaz va tarbiyachiga moliya yopiq — ularning sahifasi o'z ma'lumotini oladi
    enabled: !!user && !!period && !isChef(user.role) && !isTeacher(user.role),
  });

  // Haftalik to'lov grafigi uchun — o'sha bola ro'yxati bilan bir xil davr.
  const summaryQuery = useQuery({
    queryKey: ["dashboard-finance-summary", slug, period],
    queryFn: () => api.get<FinanceSummary>(`/app/finance/summary?period=${period}`),
    enabled: !!user && !!period && !isChef(user.role) && !isTeacher(user.role),
  });

  const [openStatus, setOpenStatus] = useState<FinanceChildStatus | null>(null);

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

  // Qolganlar (filial admini, moliyachi): barcha filiallardan shu oygi to'lov
  // holati — kim to'liq, kim yarim, kim umuman to'lamagan, har birining
  // qaysi filialga tegishli ekani bilan birga.
  const financeData = financeQuery.data;
  const totalPaid = financeData?.items.reduce((sum, item) => sum + item.paid, 0) ?? 0;
  const visibleItems = financeData?.items.filter((item) => item.status === openStatus) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {user?.branchName ?? org.name}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">{org.name}</p>
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)]">Bugun · {todayLabel()}</p>
      </div>

      {!period || financeQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : financeQuery.isError ? (
        <ErrorState message={(financeQuery.error as Error).message} />
      ) : !financeData ? null : (
        <>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <IosIcon icon={MoneyIcon} tint="accent" size={36} />
                <p className="text-[15px] font-semibold text-[var(--color-text)]">
                  Barcha filiallardan {periodLabel(financeData.period)} oyida to&apos;langan summa
                </p>
              </div>
              <PeriodPicker period={period} max={currentPeriod()} onChange={setPeriod} />
            </div>
            <p className="mt-4 text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]">
              {formatMoney(totalPaid)}
            </p>
          </div>

          {summaryQuery.data && (
            <WeeklyPaymentsChart weeks={summaryQuery.data.weeklyPayments} periodText={periodLabel(financeData.period)} />
          )}

          <PaymentStatusPie
            counts={financeData.counts}
            openStatus={openStatus}
            onToggle={(status) => setOpenStatus((s) => (s === status ? null : status))}
          />

          {openStatus && (
            <Card className="overflow-hidden">
              <div className="hairline border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
                <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                  {STATUS_META[openStatus].label} — {visibleItems.length} ta o&apos;quvchi
                </h2>
              </div>
              {visibleItems.length === 0 ? (
                <EmptyState title="Bu holatda o'quvchi yo'q" />
              ) : (
                <ul className="divide-y divide-[var(--color-separator)]">
                  {visibleItems.map((child) => (
                    <li key={child.childId} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
                        <ChildIcon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{child.fullName}</p>
                        <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                          {formatChildId(child.publicId)} · <span className="font-medium">{child.branchName}</span>
                          {child.groupName && ` · ${child.groupName}`}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14px] tabular-nums text-[var(--color-text)]">
                        <b>{formatMoney(child.paid)}</b>
                        <span className="text-[var(--color-text-muted)]"> / {formatMoney(child.billed)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
