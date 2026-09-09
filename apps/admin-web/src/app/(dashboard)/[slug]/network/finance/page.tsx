"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, getPaginated } from "@/lib/api";
import type {
  Employee,
  FinanceChildStatus,
  FinanceChildren,
  FinanceSummary,
  PayrollEntry,
  PayrollSummary,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatChildId } from "@/lib/format";
import { monogram, paletteFor } from "@/features/network/palette";
import { SplitBar, formatCompact, formatSum } from "@/features/network/money";
import { PeriodPicker, formatPeriod } from "@/features/network/period-picker";
import { ChildIcon, MoneyIcon, TeacherIcon, WalletIcon } from "@/components/ui/icons";

type Tab = "groups" | "children" | "payroll";

const TABS: { key: Tab; label: string }[] = [
  { key: "groups", label: "Guruhlar" },
  { key: "children", label: "O'quvchilar" },
  { key: "payroll", label: "Xodimlar oyligi" },
];

const CHILD_STATUS: Record<FinanceChildStatus, { label: string; chip: string; dot: string }> = {
  PAID: { label: "To'langan", chip: "bg-[var(--color-success-bg)] text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  PARTIAL: { label: "Qisman", chip: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]" },
  UNPAID: { label: "To'lanmagan", chip: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]", dot: "bg-[var(--color-danger)]" },
};

function currentPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

/**
 * Super Admin uchun tarmoq bo'ylab moliya. Filial darajasidagi
 * `/{slug}/finance` (hisob-fakturalar ro'yxati) o'z holicha qoladi — bu
 * sahifa boshqa savolga javob beradi: pul qayerdan kelyapti va qayerda qolib
 * ketyapti.
 */
export default function NetworkFinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tab, setTab] = useState<Tab>("groups");
  // Joriy oy mijoz soatiga bog'liq — effektda hisoblanadi, aks holda
  // server va brauzer HTML'i mos kelmaydi.
  const [period, setPeriod] = useState<string | null>(null);
  const [childFilter, setChildFilter] = useState<FinanceChildStatus | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setPeriod((current) => current ?? currentPeriod());
  }, []);

  const summaryQuery = useQuery({
    queryKey: ["finance-summary", slug, period],
    queryFn: () => api.get<FinanceSummary>(`/app/finance/summary?period=${period}`),
    enabled: !!period,
  });

  const childrenQuery = useQuery({
    queryKey: ["finance-children", slug, period],
    queryFn: () => api.get<FinanceChildren>(`/app/finance/children?period=${period}`),
    enabled: !!period && tab === "children",
  });

  const payrollSummaryQuery = useQuery({
    queryKey: ["payroll-summary", slug, period],
    queryFn: () => api.get<PayrollSummary>(`/app/payroll/summary?period=${period}`),
    enabled: !!period && tab === "payroll",
  });

  const payrollQuery = useQuery({
    queryKey: ["payroll-list", slug, period],
    queryFn: () => getPaginated<PayrollEntry>(`/app/payroll?period=${period}&page=1&limit=100`),
    enabled: !!period && tab === "payroll",
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, "network"],
    queryFn: () => api.get<Employee[]>("/app/employees"),
    enabled: tab === "payroll",
  });

  const summary = summaryQuery.data;

  const groupRows = useMemo(() => {
    const rows = (summary?.groups ?? []).filter((g) => g.billed > 0 || g.collected > 0);
    return rows.sort((a, b) => b.collected - a.collected);
  }, [summary]);

  const childRows = useMemo(() => {
    let items = childrenQuery.data?.items ?? [];
    if (childFilter !== "all") items = items.filter((i) => i.status === childFilter);
    const term = search.trim().toLowerCase().replace(/^id/, "");
    if (term) {
      items = items.filter(
        (i) => i.fullName.toLowerCase().includes(term) || String(i.publicId).includes(term),
      );
    }
    return items;
  }, [childrenQuery.data, childFilter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Moliya</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">
            Tarmoq bo&apos;ylab tushum, qarzdorlik va ish haqi
          </p>
        </div>
        {period && <PeriodPicker period={period} max={currentPeriod()} onChange={setPeriod} />}
      </div>

      {!period || summaryQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : summaryQuery.isError ? (
        <ErrorState message={(summaryQuery.error as Error).message} />
      ) : !summary ? (
        <EmptyState title="Ma'lumot topilmadi" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              label="Hisoblangan"
              value={summary.totals.billed}
              hint={`${summary.totals.invoiceCount} ta hisob-faktura`}
              icon={<MoneyIcon className="h-5 w-5" />}
              tone="brand"
            />
            <KpiTile
              label="Yig'ilgan"
              value={summary.totals.collected}
              hint={
                summary.totals.billed > 0
                  ? `${Math.round((summary.totals.collected / summary.totals.billed) * 100)}% undirildi`
                  : undefined
              }
              icon={<WalletIcon className="h-5 w-5" />}
              tone="success"
            />
            <KpiTile
              label="Qarzdorlik"
              value={summary.totals.outstanding}
              hint={summary.totals.outstanding > 0 ? "To'lanmagan qoldiq" : "Qarz yo'q"}
              icon={<ChildIcon className="h-5 w-5" />}
              tone={summary.totals.outstanding > 0 ? "danger" : "neutral"}
            />
            <KpiTile
              label="Kassaga tushgan"
              value={summary.totals.collectedInPeriod}
              hint={`${formatPeriod(summary.period)} davomida`}
              icon={<TeacherIcon className="h-5 w-5" />}
              tone="sky"
            />
          </div>

          {/* Bo'limlar */}
          <div className="inline-flex gap-1 rounded-full bg-[var(--color-surface-sunken)] p-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={clsx(
                  "cursor-pointer rounded-full px-4 py-2 text-[14px] font-semibold transition-colors",
                  tab === item.key
                    ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-xs)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "groups" && <GroupsPanel rows={groupRows} slug={slug} />}

          {tab === "children" && (
            <ChildrenPanel
              query={childrenQuery}
              rows={childRows}
              filter={childFilter}
              onFilter={setChildFilter}
              search={search}
              onSearch={setSearch}
              slug={slug}
            />
          )}

          {tab === "payroll" && (
            <PayrollPanel
              summary={payrollSummaryQuery.data}
              entries={payrollQuery.data?.data ?? []}
              employees={employeesQuery.data ?? []}
              loading={payrollSummaryQuery.isLoading || payrollQuery.isLoading}
              period={summary.period}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const KPI_TONE = {
  brand: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  sky: "bg-sky-50 text-sky-700",
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
} as const;

function KpiTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
  tone: keyof typeof KPI_TONE;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className={clsx("flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]", KPI_TONE[tone])}>
          {icon}
        </span>
        <span className="text-[13px] font-medium text-[var(--color-text-muted)]">{label}</span>
      </div>
      <p
        className="mt-3 text-[26px] font-bold leading-none tracking-[var(--tracking-title)] text-[var(--color-text)] tabular-nums"
        title={`${formatSum(value)} UZS`}
      >
        {formatCompact(value)}
      </p>
      {hint && <p className="mt-1.5 text-[12.5px] text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  );
}

function GroupsPanel({
  rows,
  slug,
}: {
  rows: FinanceSummary["groups"];
  slug: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Bu oyda hisob-faktura yo'q" description="Boshqa oyni tanlab ko'ring" />;
  }
  const max = Math.max(...rows.map((r) => r.billed), 1);
  return (
    <Card className="overflow-hidden">
      <div className="hairline border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
          Guruh bo&apos;yicha daromad
        </h2>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Yashil — yig&apos;ilgan, qizil — qarz. Yo&apos;lak uzunligi hisoblangan summaga mos.
        </p>
      </div>
      <ul className="divide-y divide-[var(--color-separator)]">
        {rows.map((row) => {
          const palette = row.groupId ? paletteFor(row.groupId) : null;
          const share = (row.billed / max) * 100;
          return (
            <li key={row.groupId ?? "none"} className="px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  {palette ? (
                    <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[10px] font-bold", palette.chip)}>
                      {monogram(row.groupName)}
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-surface-sunken)] text-[10px] font-bold text-[var(--color-text-muted)]">
                      —
                    </span>
                  )}
                  {row.groupId ? (
                    <Link
                      href={`/${slug}/network/groups/${row.groupId}`}
                      className="truncate text-[14px] font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]"
                    >
                      {row.groupName}
                    </Link>
                  ) : (
                    <span className="truncate text-[14px] font-semibold text-[var(--color-text)]">{row.groupName}</span>
                  )}
                </div>
                <p className="text-[14px] tabular-nums text-[var(--color-text)]">
                  <b>{formatSum(row.collected)}</b>
                  <span className="text-[var(--color-text-muted)]"> / {formatSum(row.billed)}</span>
                </p>
              </div>
              <div className="mt-2.5" style={{ width: `${Math.max(12, share)}%` }}>
                <SplitBar collected={row.collected} billed={row.billed} />
              </div>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-text-muted)]">
                {row.branchName}
                {row.outstanding > 0 ? (
                  <span className="text-[var(--color-danger)]"> · {formatSum(row.outstanding)} qarz</span>
                ) : (
                  <span className="text-[var(--color-success)]"> · to&apos;liq yig&apos;ilgan</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ChildrenPanel({
  query,
  rows,
  filter,
  onFilter,
  search,
  onSearch,
  slug,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; data?: FinanceChildren };
  rows: FinanceChildren["items"];
  filter: FinanceChildStatus | "all";
  onFilter: (value: FinanceChildStatus | "all") => void;
  search: string;
  onSearch: (value: string) => void;
  slug: string;
}) {
  const counts = query.data?.counts;
  const chips: { key: FinanceChildStatus | "all"; label: string; count?: number }[] = [
    { key: "all", label: "Hammasi", count: counts?.total },
    { key: "PAID", label: "To'langan", count: counts?.paid },
    { key: "PARTIAL", label: "Qisman", count: counts?.partial },
    { key: "UNPAID", label: "To'lanmagan", count: counts?.unpaid },
  ];

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Ism yoki ID bo'yicha qidirish"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilter(chip.key)}
              className={clsx(
                "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                filter === chip.key
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {chip.label}
              {chip.count != null && <span className="ml-1.5 opacity-70">{chip.count}</span>}
            </button>
          ))}
        </div>
      </Card>

      {query.isLoading ? (
        <LoadingState rows={5} />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState title="Bola topilmadi" description="Filtr yoki qidiruvni o'zgartirib ko'ring" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {rows.map((row) => {
              const status = CHILD_STATUS[row.status];
              return (
                <li key={row.childId} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6">
                  <span className={clsx("h-2 w-2 shrink-0 rounded-full", status.dot)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${slug}/finance/${row.childId}`}
                      className="truncate text-[14px] font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                    >
                      {row.fullName}
                    </Link>
                    <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                      {formatChildId(row.publicId)}
                      {row.groupName && ` · ${row.groupName}`}
                      {row.overdue && <span className="text-[var(--color-danger)]"> · muddati o&apos;tgan</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] tabular-nums text-[var(--color-text)]">
                      <b>{formatSum(row.paid)}</b>
                      <span className="text-[var(--color-text-muted)]"> / {formatSum(row.billed)}</span>
                    </p>
                    <span className={clsx("mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", status.chip)}>
                      {status.label}
                      {row.outstanding > 0 && ` · ${formatSum(row.outstanding)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function PayrollPanel({
  summary,
  entries,
  employees,
  loading,
  period,
}: {
  summary?: PayrollSummary;
  entries: PayrollEntry[];
  employees: Employee[];
  loading: boolean;
  period: string;
}) {
  // Ish haqi hali hisoblanmagan xodimlar ham ko'rinsin: ularda oylik
  // sxemasi bor, lekin bu oy uchun yozuv yo'q.
  const byEmployee = new Map(entries.map((entry) => [entry.employeeId, entry]));
  const rows = employees.map((employee) => ({
    employee,
    entry: byEmployee.get(employee.id) ?? null,
    scheme: employee.salaryScheme ? Number(employee.salaryScheme.fixedAmount) : null,
  }));

  if (loading) return <LoadingState rows={5} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile
          label="Oylik fondi"
          value={summary?.totals.total ?? 0}
          hint={`${summary?.totals.entries ?? 0} ta yozuv`}
          icon={<WalletIcon className="h-5 w-5" />}
          tone="brand"
        />
        <KpiTile
          label="To'langan"
          value={summary?.totals.paid ?? 0}
          icon={<MoneyIcon className="h-5 w-5" />}
          tone="success"
        />
        <KpiTile
          label="To'lanmagan"
          value={summary?.totals.unpaid ?? 0}
          hint={(summary?.totals.unpaid ?? 0) > 0 ? "Hali berilmagan" : "Hammasi berilgan"}
          icon={<TeacherIcon className="h-5 w-5" />}
          tone={(summary?.totals.unpaid ?? 0) > 0 ? "danger" : "neutral"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Xodim topilmadi" />
      ) : (
        <Card className="overflow-hidden">
          <div className="hairline border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
            <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
              Xodimlar oyligi
            </h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{formatPeriod(period)} uchun</p>
          </div>
          <ul className="divide-y divide-[var(--color-separator)]">
            {rows.map(({ employee, entry, scheme }) => (
              <li key={employee.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[11px] font-semibold text-[var(--color-primary)]">
                  {monogram(employee.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{employee.fullName}</p>
                  <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                    {employee.position}
                    {entry?.branch && ` · ${entry.branch.name}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {entry ? (
                    <>
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--color-text)]">
                        {formatSum(Number(entry.totalAmount))}
                      </p>
                      <span
                        className={clsx(
                          "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          entry.status === "PAID"
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                            : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
                        )}
                      >
                        {entry.status === "PAID" ? "To'langan" : "Hisoblangan"}
                      </span>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] tabular-nums text-[var(--color-text-muted)]">
                        {scheme ? formatSum(scheme) : "—"}
                      </p>
                      <span className="mt-0.5 inline-flex rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
                        Hisoblanmagan
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
