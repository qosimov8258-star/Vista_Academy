"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Employee, PayrollEntry, PayrollSummary, Shift, StaffAttendanceSummary } from "@/lib/types";
import { absenceNote } from "@/features/cash/staff-absence";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ClockIcon, WalletIcon } from "@/components/ui/icons";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatMoney } from "@/lib/format";
import { LogShiftModal } from "@/features/hr/log-shift-modal";
import { GeneratePayrollModal } from "@/features/hr/generate-payroll-modal";
import { EditSalarySchemeModal } from "@/features/hr/edit-salary-scheme-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney, canWriteOperational } from "@/lib/permissions";
import { useTr } from "@/i18n/tr";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

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

const PAYROLL_STATUS_LABEL: Record<PayrollEntry["status"], string> = {
  DRAFT: "Qoralama",
  PAID: "To'langan",
};

export default function HrPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  // Maosh sxemasini belgilash — moliyachi emas, faqat filial admini/administrator ishi
  // (moliyachi faqat hisoblangan summani to'laydi, sxemani o'zi yarata olmaydi).
  const canWriteScheme = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  // "Current period" depends on the viewer's clock, which can differ between
  // the server-rendered pass and the client hydration pass — computing it
  // lazily in an effect (client-only) avoids a hydration mismatch.
  const [period, setPeriod] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [payrollPage, setPayrollPage] = useState(1);
  const [logShiftOpen, setLogShiftOpen] = useState(false);
  const [generatePayrollOpen, setGeneratePayrollOpen] = useState(false);
  const [salarySchemeEmployee, setSalarySchemeEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    setPeriod((current) => current || currentPeriodString());
  }, []);

  useEffect(() => {
    setPayrollPage(1);
  }, [period]);

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const employeeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeesQuery.data ?? []) {
      map.set(employee.id, employee.fullName);
    }
    return (employeeId: string) => map.get(employeeId) ?? "—";
  }, [employeesQuery.data]);

  const shiftsQuery = useQuery({
    queryKey: ["shifts", slug, period, employeeFilter, forcedBranchId],
    queryFn: () =>
      api.get<Shift[]>(
        `/app/shifts?period=${period}${employeeFilter ? `&employeeId=${employeeFilter}` : ""}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    enabled: !!period,
  });

  // Tanlangan oyda kim necha kun kelmagan/kasal/ta'tilda bo'lgani — ish haqini hisoblashda ko'z oldida tursin.
  const attendanceSummaryQuery = useQuery({
    queryKey: ["staff-attendance-summary", slug, forcedBranchId ?? user?.branchId, period],
    queryFn: () =>
      api.get<StaffAttendanceSummary>(`/app/staff-attendance/summary?period=${period}${forcedBranchId ?? user?.branchId ? `&branchId=${forcedBranchId ?? user?.branchId}` : ""}`),
    enabled: !!period,
  });
  const absenceByEmployee = useMemo(
    () => new Map((attendanceSummaryQuery.data?.employees ?? []).map((row) => [row.employeeId, row])),
    [attendanceSummaryQuery.data],
  );

  const payrollQuery = useQuery({
    queryKey: ["payroll", slug, period, payrollPage, forcedBranchId],
    queryFn: () =>
      getPaginated<PayrollEntry>(
        `/app/payroll?page=${payrollPage}&limit=20&period=${period}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    enabled: !!period,
    placeholderData: (prev) => prev,
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/app/payroll/${id}/mark-paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", slug] });
      queryClient.invalidateQueries({ queryKey: ["payroll-summary", slug] });
    },
  });

  const payrollSummaryQuery = useQuery({
    queryKey: ["payroll-summary", slug, period, forcedBranchId],
    queryFn: () =>
      api.get<PayrollSummary>(`/app/payroll/summary?period=${period}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`),
    enabled: !!period,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {tr("Ish haqi (HR)")}
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            {tr("Xodimlar smenalari va ish haqi hisob-kitobi")}
          </p>
        </div>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{tr("Davr")}</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
        <Select
          label={tr("Xodim (smenalar uchun filtr)")}
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="sm:max-w-xs"
        >
          <option value="">{tr("Barcha xodimlar")}</option>
          {employeesQuery.data?.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {tr(employee.fullName)}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{tr("Xodimlar va maosh sxemasi")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {employeesQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : !employeesQuery.data || employeesQuery.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState title={tr("Xodim topilmadi")} />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {employeesQuery.data.map((employee) => (
                <li key={employee.id} className="flex flex-col items-start gap-3 px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{tr(employee.fullName)}</p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr(employee.position)}</p>
                    {absenceNote(absenceByEmployee.get(employee.id), tr) && (
                      <p className="text-[12.5px] text-[var(--color-danger)]">{absenceNote(absenceByEmployee.get(employee.id), tr)}</p>
                    )}
                  </div>
                  {canWriteScheme && (
                    <Button size="sm" variant="outline" onClick={() => setSalarySchemeEmployee(employee)}>
                      {tr("Maosh sxemasi")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>{tr("Ish smenalari")}</CardTitle>
          {canWrite && <Button size="sm" onClick={() => setLogShiftOpen(true)}>{tr("+ Smena qo'shish")}</Button>}
        </CardHeader>
        <CardBody className="p-0">
          {!period || shiftsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={4} />
            </div>
          ) : shiftsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={tr((shiftsQuery.error as Error).message)} />
            </div>
          ) : !shiftsQuery.data || shiftsQuery.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title={tr("Bu davr uchun smena topilmadi")}
                icon={<ClockIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <>
            <ul className="divide-y divide-[var(--color-separator)] md:hidden">
              {shiftsQuery.data.map((shift) => (
                <li key={shift.id} className="space-y-1 px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[14px] font-medium">{employeeName(shift.employeeId)}</span>
                    <span className="shrink-0 text-[14px] font-medium tabular-nums">{tr(shift.hours)} {tr("soat")}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-[var(--color-text-muted)]">
                    <span className="tabular-nums">{formatDate(shift.date)}</span>
                    {shift.note && <span className="min-w-0 break-words text-right">{tr(shift.note)}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
            <DataTable>
              <THead>
                <tr>
                  <Th>{tr("Xodim")}</Th>
                  <Th>{tr("Sana")}</Th>
                  <Th numeric>{tr("Soat")}</Th>
                  <Th>{tr("Izoh")}</Th>
                </tr>
              </THead>
              <TBody>
                {shiftsQuery.data.map((shift) => (
                  <Tr key={shift.id}>
                    <Td className="font-medium">{employeeName(shift.employeeId)}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(shift.date)}</Td>
                    <Td numeric>{tr(shift.hours)}</Td>
                    <Td className="text-[var(--color-text-muted)]">{shift.note ?? "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
            </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>{tr("Ish haqi")}</CardTitle>
          {canWrite && (
            <Button size="sm" onClick={() => setGeneratePayrollOpen(true)}>
              {tr("+ Ish haqi hisoblash")}
            </Button>
          )}
        </CardHeader>
        {payrollSummaryQuery.data && payrollSummaryQuery.data.totals.entries > 0 && (
          <div className="grid grid-cols-2 gap-px border-b border-[var(--color-separator)] bg-[var(--color-separator)] sm:grid-cols-4">
            <div className="bg-[var(--color-surface)] px-5 py-3.5 sm:px-6">
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tr("Umumiy fond")}</p>
              <p className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">
                {formatMoney(payrollSummaryQuery.data.totals.total)}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] px-5 py-3.5 sm:px-6">
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tr("To'langan")}</p>
              <p className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-success)]">
                {formatMoney(payrollSummaryQuery.data.totals.paid)}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] px-5 py-3.5 sm:px-6">
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tr("To'lanmagan")}</p>
              <p className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-danger)]">
                {formatMoney(payrollSummaryQuery.data.totals.unpaid)}
              </p>
            </div>
            <div className="bg-[var(--color-surface)] px-5 py-3.5 sm:px-6">
              <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tr("Yozuvlar soni")}</p>
              <p className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">
                {tr(payrollSummaryQuery.data.totals.entries)}
              </p>
            </div>
          </div>
        )}
        <CardBody className="p-0">
          {!period || payrollQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={5} />
            </div>
          ) : payrollQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={tr((payrollQuery.error as Error).message)} />
            </div>
          ) : !payrollQuery.data || payrollQuery.data.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title={tr("Bu davr uchun ish haqi hisoblanmagan")}
                icon={<WalletIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[var(--color-separator)] md:hidden">
                {payrollQuery.data.data.map((entry) => {
                  const note = absenceNote(absenceByEmployee.get(entry.employeeId), tr);
                  const rows: [string, string, string][] = [
                    ["Asosiy", formatMoney(entry.baseAmount), ""],
                    ["Mukofot", formatMoney(entry.bonusAmount), "text-[var(--color-success)]"],
                    ["Jarima", formatMoney(entry.penaltyAmount), "text-[var(--color-danger)]"],
                    ["Ushlab qolish", formatMoney(entry.deductionAmount), "text-[var(--color-danger)]"],
                  ];
                  return (
                    <li key={entry.id} className="space-y-2.5 px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-[14px] font-medium">
                            {entry.employee?.fullName ?? employeeName(entry.employeeId)}
                          </p>
                          <p className="text-[12.5px] tabular-nums text-[var(--color-text-muted)]">{tr(entry.period)}</p>
                          {note && <p className="text-[12px] text-[var(--color-danger)]">{tr(note)}</p>}
                        </div>
                        <Badge tone={entry.status === "PAID" ? "success" : "warning"}>
                          {tr(PAYROLL_STATUS_LABEL[entry.status])}
                        </Badge>
                      </div>
                      <dl className="space-y-1 text-[13px]">
                        {rows.map(([label, value, tone]) => (
                          <div key={label} className="flex items-baseline justify-between gap-3">
                            <dt className="text-[var(--color-text-muted)]">{tr(label)}</dt>
                            <dd className={`tabular-nums ${tone}`}>{tr(value)}</dd>
                          </div>
                        ))}
                        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-separator)] pt-1.5 text-[14px] font-semibold">
                          <dt>{tr("Jami")}</dt>
                          <dd className="tabular-nums">{formatMoney(entry.totalAmount)}</dd>
                        </div>
                        {entry.paidAt && (
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-[var(--color-text-muted)]">{tr("To'langan sana")}</dt>
                            <dd className="tabular-nums">{formatDate(entry.paidAt)}</dd>
                          </div>
                        )}
                      </dl>
                      {canWrite && entry.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          loading={markPaidMutation.isPending && markPaidMutation.variables === entry.id}
                          onClick={() => markPaidMutation.mutate(entry.id)}
                        >
                          {tr("To'landi deb belgilash")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden md:block">
              <DataTable className="min-w-[880px]">
                <THead>
                  <tr>
                    <Th>{tr("Xodim")}</Th>
                    <Th>{tr("Davr")}</Th>
                    <Th numeric>{tr("Asosiy")}</Th>
                    <Th numeric>{tr("Mukofot")}</Th>
                    <Th numeric>{tr("Jarima")}</Th>
                    <Th numeric>{tr("Ushlab qolish")}</Th>
                    <Th numeric>{tr("Jami")}</Th>
                    <Th>{tr("Holat")}</Th>
                    <Th>{tr("To'langan sana")}</Th>
                    <Th></Th>
                  </tr>
                </THead>
                <TBody>
                  {payrollQuery.data.data.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="font-medium">
                        {entry.employee?.fullName ?? employeeName(entry.employeeId)}
                        {absenceNote(absenceByEmployee.get(entry.employeeId), tr) && (
                          <div className="text-[12px] font-normal text-[var(--color-danger)]">
                            {absenceNote(absenceByEmployee.get(entry.employeeId), tr)}
                          </div>
                        )}
                      </Td>
                      <Td className="tabular-nums text-[var(--color-text-muted)]">{tr(entry.period)}</Td>
                      <Td numeric className="text-[var(--color-text-muted)]">
                        {formatMoney(entry.baseAmount)}
                      </Td>
                      <Td numeric className="text-[var(--color-success)]">{formatMoney(entry.bonusAmount)}</Td>
                      <Td numeric className="text-[var(--color-danger)]">{formatMoney(entry.penaltyAmount)}</Td>
                      <Td numeric className="text-[var(--color-danger)]">{formatMoney(entry.deductionAmount)}</Td>
                      <Td numeric className="font-medium">{formatMoney(entry.totalAmount)}</Td>
                      <Td>
                        <Badge tone={entry.status === "PAID" ? "success" : "warning"}>
                          {tr(PAYROLL_STATUS_LABEL[entry.status])}
                        </Badge>
                      </Td>
                      <Td className="tabular-nums text-[var(--color-text-muted)]">
                        {entry.paidAt ? formatDate(entry.paidAt) : "—"}
                      </Td>
                      <Td className="text-right">
                        {canWrite && entry.status === "DRAFT" && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={markPaidMutation.isPending && markPaidMutation.variables === entry.id}
                            onClick={() => markPaidMutation.mutate(entry.id)}
                          >
                            {tr("To'landi deb belgilash")}
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </DataTable>
              </div>

              {markPaidMutation.isError && (
                <div className="px-5 py-3.5 text-[13px] text-[var(--color-danger)] sm:px-6">
                  {markPaidMutation.error instanceof ApiError
                    ? markPaidMutation.error.message
                    : tr("Kutilmagan xatolik yuz berdi")}
                </div>
              )}

              <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
                <span className="tabular-nums">
                  {tr("Jami")}{" "}{tr(payrollQuery.data.meta.total)} {tr("ta,")}{" "}{tr(payrollQuery.data.meta.page)}{tr("-sahifa")}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={payrollPage <= 1}
                    onClick={() => setPayrollPage((p) => p - 1)}
                  >
                    {tr("Oldingi")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={payrollPage * payrollQuery.data.meta.limit >= payrollQuery.data.meta.total}
                    onClick={() => setPayrollPage((p) => p + 1)}
                  >
                    {tr("Keyingi")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {canWrite && <LogShiftModal open={logShiftOpen} onClose={() => setLogShiftOpen(false)} slug={slug} />}
      {canWrite && (
        <GeneratePayrollModal open={generatePayrollOpen} onClose={() => setGeneratePayrollOpen(false)} slug={slug} />
      )}
      {canWriteScheme && salarySchemeEmployee && (
        <EditSalarySchemeModal
          open={!!salarySchemeEmployee}
          onClose={() => setSalarySchemeEmployee(null)}
          slug={slug}
          employeeId={salarySchemeEmployee.id}
          employeeName={salarySchemeEmployee.fullName}
        />
      )}
    </div>
  );
}
