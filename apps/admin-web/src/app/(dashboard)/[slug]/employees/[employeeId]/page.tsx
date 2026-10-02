"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { Employee, EmployeePayrollOverview, PayrollEntry, StaffAttendanceHistory, StaffAttendanceStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { AmountInput } from "@/components/ui/amount-input";
import { ArrowLeftIcon, PhoneIcon } from "@/components/ui/icons";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { Toast, type ToastState } from "@/components/ui/toast";
import { formatPositionLabel } from "@/lib/employee-position";
import { formatMoney, formatDate } from "@/lib/format";
import { canWriteOperational } from "@/lib/permissions";
import { EditSalarySchemeModal } from "@/features/hr/edit-salary-scheme-modal";
import { PeriodPicker } from "@/features/network/period-picker";
import { useTr } from "@/i18n/tr";

const DEFAULT_TIMEZONE = "Asia/Tashkent";
// Kalendar dushanbadan boshlanadi — `Date#getUTCDay()` yakshanbani 0 deb sanaydi.
const WEEKDAY_SHORT = ["Du", "Se", "Cho", "Pay", "Ju", "Sha", "Yak"];

function currentPeriodString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

const STATUS_CELL: Record<StaffAttendanceStatus, string> = {
  PRESENT: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  LATE: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
  ABSENT: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  SICK: "bg-sky-50 text-sky-700",
  ON_LEAVE: "bg-sky-50 text-sky-700",
};

const STATUS_LABEL: Record<StaffAttendanceStatus, string> = {
  PRESENT: "Keldi",
  LATE: "Kech qoldi",
  ABSENT: "Kelmadi",
  SICK: "Kasal",
  ON_LEAVE: "Ta'til",
};

type CalendarCell = { date: string; day: number; isWeekend: boolean; status: StaffAttendanceStatus | null };

function buildCalendarWeeks(period: string, days: { date: string; status: StaffAttendanceStatus }[]): (CalendarCell | null)[][] {
  const [year, month] = period.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekdaySun0 = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const leading = (firstWeekdaySun0 + 6) % 7; // dushanba-boshi ofset
  const statusByDate = new Map(days.map((d) => [d.date, d.status]));

  const cells: (CalendarCell | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${period}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    cells.push({ date, day, isWeekend: weekday === 0 || weekday === 6, status: statusByDate.get(date) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Moliyachi "Xodimlar" ro'yxatida xodim ustiga bosganda ochiladigan to'liq
 * sahifa — bola moliya sahifasi bilan bir xil qolipda: shu oylik davomat
 * kalendari (keldi/kech qoldi/kelmadi/dam kuni), hisoblangan oylik va
 * to'lash imkoniyati, pastda esa o'tgan oylarda yopilgan oyliklar tarixi.
 */
export default function EmployeeFinancePage({ params }: { params: Promise<{ slug: string; employeeId: string }> }) {
  const tr = useTr();
  const { slug, employeeId } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Maosh sxemasini belgilash — moliyachi emas, faqat filial admini/administrator ishi:
  // moliyachi bu sahifada faqat hisoblangan summani ko'radi va to'laydi, sxemani o'zi
  // yarata olmaydi (sxema hisoblash turini — soatlik/bola soni/belgilangan oylik — belgilaydi).
  const canWriteScheme = canWriteOperational(user?.role);
  const { branches } = useBranchContext(slug);
  // `useBranchContext`ning branchSlug/branchId'i shu sahifada ishonchsiz —
  // sabab: employees/page.tsx dagi izohga qarang (bu komponent ham xuddi
  // shunday, filial marshruti orqali qayta eksport qilinadigan sahifa).
  // Filialni joriy `pathname`dan o'zimiz aniqlaymiz.
  const pathname = usePathname();
  const pathBranchSlug = pathname.split("/").filter(Boolean)[1] ?? null;
  const forcedBranch = pathBranchSlug ? (branches.find((b) => b.slug === pathBranchSlug) ?? null) : null;
  const forcedBranchId = forcedBranch?.id ?? null;
  const branchId = forcedBranchId ?? user?.branchId ?? "";
  const employeesHref = forcedBranch ? `/${slug}/${forcedBranch.slug}/employees` : `/${slug}/employees`;

  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    setPeriod((current) => current || currentPeriodString());
  }, []);

  // Davr almashsa — oldingi qoralama summa yangisiga aralashmasin.
  useEffect(() => {
    setAmount(undefined);
    setPayError(null);
  }, [employeeId, period]);

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const employee = employeesQuery.data?.find((e) => e.id === employeeId) ?? null;

  const historyQuery = useQuery({
    queryKey: ["staff-attendance-history", slug, employeeId, branchId, period],
    queryFn: () =>
      api.get<StaffAttendanceHistory>(
        `/app/staff-attendance/history?employeeId=${employeeId}&branchId=${branchId}&period=${period}`,
      ),
    enabled: !!employeeId && !!branchId && !!period,
  });

  const overviewQuery = useQuery({
    queryKey: ["employee-payroll-overview", slug, employeeId, period],
    queryFn: () => api.get<EmployeePayrollOverview>(`/app/employees/${employeeId}/payroll?period=${period}`),
    enabled: !!employeeId && !!period,
  });

  const paidHistoryQuery = useQuery({
    queryKey: ["payroll", slug, "employee-history", employeeId],
    queryFn: () => getPaginated<PayrollEntry>(`/app/payroll?employeeId=${employeeId}&status=PAID&page=1&limit=12`),
    enabled: !!employeeId,
  });

  const overview = overviewQuery.data;
  const computedTotal = overview?.entry ? Number(overview.entry.totalAmount) : (overview?.preview?.totalAmount ?? null);
  const alreadyPaidThisPeriod = overview?.entry?.status === "PAID";

  // Summa maydoni hali qo'lda to'ldirilmagan bo'lsa, hisoblangan summani taklif qiladi.
  useEffect(() => {
    if (amount !== undefined || alreadyPaidThisPeriod || computedTotal === null) return;
    setAmount(computedTotal);
  }, [amount, alreadyPaidThisPeriod, computedTotal]);

  const payMutation = useMutation({
    mutationFn: (value: number) =>
      api.post<PayrollEntry>(`/app/employees/${employeeId}/payroll/pay`, { period, amount: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-payroll-overview", slug, employeeId] });
      queryClient.invalidateQueries({ queryKey: ["payroll", slug] });
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      queryClient.invalidateQueries({ queryKey: ["payroll-summary", slug] });
      setPayError(null);
      setToast({ type: "success", message: tr("To'landi") });
    },
    onError: (err) => {
      setPayError(err instanceof ApiError ? err.message : tr("To'lab bo'lmadi"));
    },
  });

  if (employeesQuery.isLoading) return <LoadingState />;
  if (employeesQuery.isError) return <ErrorState message={tr((employeesQuery.error as Error).message)} />;
  if (!employee) return <ErrorState message={tr("Xodim topilmadi")} />;

  const days = historyQuery.data?.days ?? [];
  const weeks = period ? buildCalendarWeeks(period, days) : [];
  const today = todayDateString();
  const counts = days.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<StaffAttendanceStatus, number>>,
  );

  return (
    <div className="space-y-5">
      <Link
        href={employeesHref}
        className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        {tr("Xodimlar")}
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
          <EmployeePhoto
            employee={employee}
            size={72}
            shape="circle"
            fallback={initials(employee.fullName)}
            className="text-[22px]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-semibold leading-tight tracking-[var(--tracking-title)] text-[var(--color-text)]">
                {tr(employee.fullName)}
              </h1>
              <Badge tone={employee.isActive ? "success" : "neutral"}>{employee.isActive ? "Faol" : "Nofaol"}</Badge>
            </div>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">
              {tr(formatPositionLabel(employee.position, employee.subjects))}
            </p>
            {employee.teachingGroups?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {employee.teachingGroups.map((link) => (
                  <Badge key={link.groupId} tone="primary">
                    {link.group?.name ?? tr("Guruh")}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-[var(--color-separator)] px-5 py-3.5 sm:px-6">
          <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <span className="text-[14px] text-[var(--color-text)]">{employee.phone ?? "Telefon raqami kiritilmagan"}</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <CardTitle>{tr("Davomat")}</CardTitle>
          {period && <PeriodPicker period={period} max={currentPeriodString()} onChange={setPeriod} />}
        </div>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="success">{tr("Keldi:")}{" "}{counts.PRESENT ?? 0}</Badge>
            <Badge tone="warning">{tr("Kech qoldi:")}{" "}{counts.LATE ?? 0}</Badge>
            <Badge tone="danger">{tr("Kelmadi:")}{" "}{counts.ABSENT ?? 0}</Badge>
            {(counts.SICK ?? 0) + (counts.ON_LEAVE ?? 0) > 0 && (
              <Badge tone="info">{tr("Kasal/Ta'til:")}{" "}{(counts.SICK ?? 0) + (counts.ON_LEAVE ?? 0)}</Badge>
            )}
          </div>

          {historyQuery.isLoading ? (
            <LoadingState rows={2} />
          ) : historyQuery.isError ? (
            <ErrorState message={tr((historyQuery.error as Error).message)} />
          ) : (
            <div className="max-w-md space-y-1">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[var(--color-text-muted)]">
                {WEEKDAY_SHORT.map((w) => (
                  <span key={w}>{tr(w)}</span>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((cell, ci) =>
                    cell === null ? (
                      <span key={ci} />
                    ) : (
                      <span
                        key={ci}
                        title={
                          cell.status
                            ? STATUS_LABEL[cell.status]
                            : cell.isWeekend
                              ? "Dam olish kuni"
                              : cell.date === today
                                ? "Bugun"
                                : "Belgilanmagan"
                        }
                        className={clsx(
                          "flex aspect-square items-center justify-center rounded-[var(--radius-md)] text-[12px] font-medium",
                          cell.status
                            ? STATUS_CELL[cell.status]
                            : cell.isWeekend
                              ? "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]"
                              : cell.date === today
                                ? "border border-[var(--color-primary)] text-[var(--color-text)]"
                                : "border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)]",
                        )}
                      >
                        {tr(cell.day)}
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{tr("Oylik —")}{" "}{tr(period)}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {overviewQuery.isLoading ? (
            <LoadingState rows={2} />
          ) : !overview?.scheme && !overview?.entry ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text-muted)]">{tr("Maosh sxemasi belgilanmagan")}</p>
              {canWriteScheme && (
                <Button type="button" variant="outline" size="sm" onClick={() => setSchemeModalOpen(true)}>
                  {tr("Sxema belgilash")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--color-text-muted)]">{tr("Hisoblangan summa")}</span>
              <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">
                {formatMoney(computedTotal ?? 0)}
              </span>
            </div>
          )}

          {alreadyPaidThisPeriod ? (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-success-bg)] px-3.5 py-3">
              <div>
                <p className="text-[13px] font-medium text-[var(--color-success)]">{tr("To'langan")}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {overview!.entry!.paidAt ? formatDate(overview!.entry!.paidAt) : ""}
                </p>
              </div>
              <span className="text-[15px] font-semibold tabular-nums text-[var(--color-success)]">
                {formatMoney(overview!.entry!.paidAmount)}
              </span>
            </div>
          ) : (
            <div className="max-w-sm space-y-2 border-t border-[var(--color-border)] pt-3">
              <AmountInput label={tr("To'lanadigan summa")} placeholder="2 000 000" value={amount} onChange={setAmount} />
              {payError && <p className="text-xs text-[var(--color-danger)]">{tr(payError)}</p>}
              <div className="flex justify-end">
                <Button
                  type="button"
                  loading={payMutation.isPending}
                  disabled={!amount}
                  onClick={() => amount && payMutation.mutate(amount)}
                >
                  {tr("To'lash")}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{tr("Yopilgan oyliklar")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {paidHistoryQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={2} />
            </div>
          ) : !paidHistoryQuery.data || paidHistoryQuery.data.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <p className="text-sm text-[var(--color-text-muted)]">{tr("Hali to'langan oylik yo'q")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {paidHistoryQuery.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6"
                >
                  <div>
                    <p className="text-[13.5px] font-medium text-[var(--color-text)]">{tr(entry.period)}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      {entry.paidAt ? formatDate(entry.paidAt) : "—"}
                    </p>
                  </div>
                  <span className="text-[13.5px] font-semibold tabular-nums text-[var(--color-success)]">
                    {formatMoney(entry.paidAmount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {canWriteScheme && (
        <EditSalarySchemeModal
          open={schemeModalOpen}
          onClose={() => {
            setSchemeModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["employee-payroll-overview", slug, employee.id] });
          }}
          slug={slug}
          employeeId={employee.id}
          employeeName={employee.fullName}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
