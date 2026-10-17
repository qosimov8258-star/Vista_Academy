"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Employee, PayrollEntry, PayrollSummary, Shift, StaffAttendanceSummary } from "@/lib/types";
import { absenceNote } from "@/features/cash/staff-absence";
import { useAuth } from "@/lib/use-auth";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { IosButton } from "@/components/ios/button";
import { PeriodStepper } from "@/components/ios/day-stepper";
import { Group as IosGroup, ListRow, Row } from "@/components/ios/group";
import { ClockIcon, MoneyIcon, PlusIcon, TeacherIcon } from "@/components/ios/icons";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_PRESS } from "@/components/ios/tokens";
import { formatDate, formatMoney } from "@/lib/format";
import { periodLabel, shiftPeriod } from "@/features/payments/shared";
import { LogShiftModal } from "@/features/hr/log-shift-modal";
import { GeneratePayrollModal } from "@/features/hr/generate-payroll-modal";
import { EditSalarySchemeModal } from "@/features/hr/edit-salary-scheme-modal";
import { EmployeePicker } from "@/features/hr/employee-picker";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";
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
const PAYROLL_STATUS_COLOR: Record<PayrollEntry["status"], string> = {
  DRAFT: IOS.orange,
  PAID: IOS.green,
};

export default function HrPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  // Maosh sxemasini belgilash — moliyachi emas, faqat filial admini/administrator ishi
  // (moliyachi faqat hisoblangan summani to'laydi, sxemani o'zi yarata olmaydi).
  const canWriteScheme = canWriteMoney(user?.role);
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
  // Ish haqi yozuvi tafsiloti (varaq) — summalar va "To'landi" amali shu yerda
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [thisMonth, setThisMonth] = useState("");

  useEffect(() => {
    const now = currentPeriodString();
    setThisMonth(now);
    setPeriod((current) => current || now);
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

  // Xodim qatorida shu oyning oyligi (sahifalashdan qat'i nazar) — hamma yozuvlar bitta so'rovda
  const monthPayrollQuery = useQuery({
    queryKey: ["payroll", slug, period, "by-employee", forcedBranchId],
    queryFn: () =>
      getPaginated<PayrollEntry>(
        `/app/payroll?page=1&limit=100&period=${period}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    enabled: !!period,
  });
  const payrollByEmployee = useMemo(
    () => new Map((monthPayrollQuery.data?.data ?? []).map((entry) => [entry.employeeId, entry])),
    [monthPayrollQuery.data],
  );

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

  const entries = payrollQuery.data?.data ?? [];
  const openEntry = entries.find((entry) => entry.id === openEntryId) ?? null;
  const entryName = (entry: PayrollEntry) => entry.employee?.fullName ?? employeeName(entry.employeeId);
  const summary = payrollSummaryQuery.data?.totals;
  const sectionAction = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={label} className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1 text-[var(--color-primary)] transition-opacity active:opacity-50">
      <PlusIcon className="h-4 w-4" strokeWidth={2.4} />
      <span className="max-sm:sr-only">{label}</span>
    </button>
  );

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <PageHeaderCard
          icon={MoneyIcon}
          tint="green"
          title={tr("Ish haqi (HR)")}
          subtitle={tr("Xodimlar smenalari va ish haqi hisob-kitobi")}
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        {period && (
          <PeriodStepper
            onPrev={() => setPeriod((p) => shiftPeriod(p, -1))}
            onNext={() => setPeriod((p) => shiftPeriod(p, 1))}
            prevLabel={tr("Oldingi oy")}
            nextLabel={tr("Keyingi oy")}
            reset={thisMonth && period !== thisMonth ? { label: tr("Shu oy"), onClick: () => setPeriod(thisMonth) } : undefined}
          >
            {periodLabel(period, tr)}
          </PeriodStepper>
        )}

        {/* Xodimlar va maosh sxemasi — qator bosilsa sxema varag'i */}
        <IosGroup
          title={tr("Xodimlar va maosh sxemasi")}
          refreshing={employeesQuery.isFetching && !employeesQuery.isLoading}
          footer={canWriteScheme && employeesQuery.data?.length ? tr("Maosh sxemasini belgilash uchun xodimni bosing") : undefined}
          bare
        >
          {employeesQuery.isLoading ? (
            <SkeletonRows rows={3} />
          ) : employeesQuery.isError ? (
            <ErrorState message={(employeesQuery.error as Error).message} onRetry={() => employeesQuery.refetch()} retrying={employeesQuery.isFetching} />
          ) : !employeesQuery.data || employeesQuery.data.length === 0 ? (
            <EmptyState icon={TeacherIcon} title="Xodim topilmadi" />
          ) : (
            <div className={GROUP_BLOCK}>
              {employeesQuery.data.map((employee) => {
                const note = absenceNote(absenceByEmployee.get(employee.id), tr);
                return (
                  <ListRow
                    key={employee.id}
                    onClick={canWriteScheme ? () => setSalarySchemeEmployee(employee) : undefined}
                    avatar={<EmployeePhoto employee={employee} size={44} shape="circle" fallback={initials(employee.fullName)} className="text-[15px]" />}
                    title={tr(employee.fullName)}
                    subtitle={
                      <>
                        {tr(employee.position)}
                        <SchemeText employee={employee} className="sm:hidden" prefix=" · " />
                        {note && <span className="text-[#ff3b30]"> · {note}</span>}
                      </>
                    }
                    meta={<SalaryInfo employee={employee} entry={payrollByEmployee.get(employee.id)} loading={monthPayrollQuery.isLoading} />}
                  />
                );
              })}
            </div>
          )}
        </IosGroup>

        {/* Ish smenalari */}
        <IosGroup
          title={<span className="whitespace-nowrap">{tr("Ish smenalari")}</span>}
          refreshing={shiftsQuery.isFetching && !shiftsQuery.isLoading}
          action={
            <div className="flex items-center gap-3">
              <EmployeePicker
                variant="pill"
                title={tr("Xodim (smenalar uchun filtr)")}
                value={employeeFilter}
                onChange={setEmployeeFilter}
                employees={employeesQuery.data ?? []}
                loading={employeesQuery.isLoading}
                placeholder={tr("Barcha xodimlar")}
                allOption={tr("Barcha xodimlar")}
              />
              {canWrite && sectionAction(tr("Qo'shish"), () => setLogShiftOpen(true))}
            </div>
          }
          bare
        >
          {!period || shiftsQuery.isLoading ? (
            <SkeletonRows rows={4} avatar={false} />
          ) : shiftsQuery.isError ? (
            <ErrorState message={(shiftsQuery.error as Error).message} onRetry={() => shiftsQuery.refetch()} retrying={shiftsQuery.isFetching} />
          ) : !shiftsQuery.data || shiftsQuery.data.length === 0 ? (
            <EmptyState icon={ClockIcon} title="Bu davr uchun smena topilmadi" />
          ) : (
            <div className={GROUP_BLOCK}>
              {shiftsQuery.data.map((shift) => (
                <Row
                  key={shift.id}
                  title={employeeName(shift.employeeId)}
                  subtitle={[formatDate(shift.date), shift.note ? tr(shift.note) : null].filter(Boolean).join(" · ")}
                  value={`${tr(shift.hours)} ${tr("soat")}`}
                />
              ))}
            </div>
          )}
        </IosGroup>

        {/* Ish haqi */}
        <IosGroup
          title={tr("Ish haqi")}
          refreshing={payrollQuery.isFetching && !payrollQuery.isLoading}
          action={canWrite ? sectionAction(tr("Hisoblash"), () => setGeneratePayrollOpen(true)) : undefined}
          bare
        >
          <div className="space-y-3">
            {summary && summary.entries > 0 && (
              <StatStrip tone="white">
                <StatCell label={tr("Umumiy fond")} value={<StatMoney value={summary.total} />} />
                <StatCell label={tr("To'langan")} value={<StatMoney value={summary.paid} />} color={IOS.green} />
                <StatCell label={tr("To'lanmagan")} value={<StatMoney value={summary.unpaid} />} color={IOS.red} />
                <StatCell label={tr("Yozuvlar soni")} value={tr(summary.entries)} />
              </StatStrip>
            )}

            {!period || payrollQuery.isLoading ? (
              <SkeletonRows rows={5} />
            ) : payrollQuery.isError ? (
              <ErrorState message={(payrollQuery.error as Error).message} onRetry={() => payrollQuery.refetch()} retrying={payrollQuery.isFetching} />
            ) : entries.length === 0 ? (
              <EmptyState icon={MoneyIcon} title="Bu davr uchun ish haqi hisoblanmagan" />
            ) : (
              <>
                {/* Telefon va planshet — qatorlar, bosilsa tafsilot varag'i */}
                <div className={`${GROUP_BLOCK} xl:hidden`}>
                  {entries.map((entry) => {
                    const note = absenceNote(absenceByEmployee.get(entry.employeeId), tr);
                    return (
                      <ListRow
                        key={entry.id}
                        onClick={() => setOpenEntryId(entry.id)}
                        title={entryName(entry)}
                        subtitle={
                          <>
                            <span className="tabular-nums">{formatMoney(entry.totalAmount)}</span>
                            {note && <span className="text-[#ff3b30]"> · {note}</span>}
                          </>
                        }
                        meta={<Pill color={PAYROLL_STATUS_COLOR[entry.status]}>{tr(PAYROLL_STATUS_LABEL[entry.status])}</Pill>}
                      />
                    );
                  })}
                </div>

                {/* Katta ekran — jadval, qator bosilsa tafsilot varag'i */}
                <div className={`${GROUP_BLOCK} hidden overflow-x-auto xl:block`}>
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#6d6d72]">
                        <th className="px-4 py-3">{tr("Xodim")}</th>
                        <th className="px-4 py-3">{tr("Davr")}</th>
                        <th className="px-4 py-3 text-right">{tr("Asosiy")}</th>
                        <th className="px-4 py-3 text-right">{tr("Mukofot")}</th>
                        <th className="px-4 py-3 text-right">{tr("Jarima")}</th>
                        <th className="px-4 py-3 text-right">{tr("Ushlab qolish")}</th>
                        <th className="px-4 py-3 text-right">{tr("Jami")}</th>
                        <th className="px-4 py-3">{tr("Holat")}</th>
                        <th className="px-4 py-3">{tr("To'langan sana")}</th>
                        <th className="w-px px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const note = absenceNote(absenceByEmployee.get(entry.employeeId), tr);
                        return (
                          <tr key={entry.id} onClick={() => setOpenEntryId(entry.id)} className={`cursor-pointer border-t border-[#c6c6c8]/50 ${ROW_PRESS}`}>
                            <td className="max-w-[240px] px-4 py-2.5">
                              <p className="truncate font-medium text-[var(--color-text)]">{entryName(entry)}</p>
                              {note && <p className="truncate text-[12.5px] text-[#ff3b30]">{note}</p>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[#8e8e93]">{periodLabel(entry.period, tr)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-[#8e8e93]">{formatMoney(entry.baseAmount)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums" style={{ color: IOS.green }}>{formatMoney(entry.bonusAmount)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums" style={{ color: IOS.red }}>{formatMoney(entry.penaltyAmount)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums" style={{ color: IOS.red }}>{formatMoney(entry.deductionAmount)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-[var(--color-text)]">{formatMoney(entry.totalAmount)}</td>
                            <td className="px-4 py-2.5">
                              <Pill color={PAYROLL_STATUS_COLOR[entry.status]}>{tr(PAYROLL_STATUS_LABEL[entry.status])}</Pill>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[#8e8e93]">{entry.paidAt ? formatDate(entry.paidAt) : "—"}</td>
                            {/* Qatorda amal tugmasi yo'q — "To'landi" varaq ichida */}
                            <td className="w-px px-4 py-2.5 text-[#c7c7cc]">›</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {payrollQuery.data && (
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-[12.5px] tabular-nums text-[#8e8e93]">
                      {tr("Jami")} {tr(payrollQuery.data.meta.total)} {tr("ta,")} {tr(payrollQuery.data.meta.page)}
                      {tr("-sahifa")}
                    </span>
                    <div className="flex gap-2">
                      <IosButton label={tr("Oldingi")} className="h-9 px-4 text-[14px]" disabled={payrollPage <= 1} onClick={() => setPayrollPage((p) => p - 1)} />
                      <IosButton
                        label={tr("Keyingi")}
                        className="h-9 px-4 text-[14px]"
                        disabled={payrollPage * payrollQuery.data.meta.limit >= payrollQuery.data.meta.total}
                        onClick={() => setPayrollPage((p) => p + 1)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </IosGroup>
      </div>

      {/* Ish haqi yozuvi tafsiloti */}
      <IosSheet
        open={openEntry !== null}
        onClose={() => {
          if (markPaidMutation.isPending) return;
          setOpenEntryId(null);
          markPaidMutation.reset();
        }}
        cancelLabel="Yopish"
        title={openEntry ? entryName(openEntry) : ""}
        footer={
          openEntry && canWrite && openEntry.status === "DRAFT" ? (
            <SheetPrimaryButton
              loading={markPaidMutation.isPending}
              onClick={() => markPaidMutation.mutate(openEntry.id, { onSuccess: () => setOpenEntryId(null) })}
            >
              {tr("To'landi deb belgilash")}
            </SheetPrimaryButton>
          ) : undefined
        }
      >
        {openEntry && (
          <>
            <div className="flex justify-center pt-1">
              <Pill color={PAYROLL_STATUS_COLOR[openEntry.status]}>{tr(PAYROLL_STATUS_LABEL[openEntry.status])}</Pill>
            </div>
            {markPaidMutation.isError && (
              <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
                {markPaidMutation.error instanceof ApiError ? tr(markPaidMutation.error.message) : tr("Kutilmagan xatolik yuz berdi")}
              </p>
            )}
            <SheetSection footer={absenceNote(absenceByEmployee.get(openEntry.employeeId), tr) ?? undefined}>
              <SheetRow label={tr("Davr")}>{periodLabel(openEntry.period, tr)}</SheetRow>
              <SheetRow label={tr("Asosiy")}>
                <span className="tabular-nums">{formatMoney(openEntry.baseAmount)}</span>
              </SheetRow>
              <SheetRow label={tr("Mukofot")}>
                <span className="tabular-nums" style={{ color: IOS.green }}>{formatMoney(openEntry.bonusAmount)}</span>
              </SheetRow>
              <SheetRow label={tr("Jarima")}>
                <span className="tabular-nums" style={{ color: IOS.red }}>{formatMoney(openEntry.penaltyAmount)}</span>
              </SheetRow>
              <SheetRow label={tr("Ushlab qolish")}>
                <span className="tabular-nums" style={{ color: IOS.red }}>{formatMoney(openEntry.deductionAmount)}</span>
              </SheetRow>
              <SheetRow label={<span className="font-semibold">{tr("Jami")}</span>}>
                <span className="font-semibold tabular-nums text-[var(--color-text)]">{formatMoney(openEntry.totalAmount)}</span>
              </SheetRow>
              {openEntry.paidAt && (
                <SheetRow label={tr("To'langan sana")}>
                  <span className="tabular-nums">{formatDate(openEntry.paidAt)}</span>
                </SheetRow>
              )}
            </SheetSection>
          </>
        )}
      </IosSheet>

      {canWrite && <LogShiftModal open={logShiftOpen} onClose={() => setLogShiftOpen(false)} slug={slug} />}
      {canWrite && <GeneratePayrollModal open={generatePayrollOpen} onClose={() => setGeneratePayrollOpen(false)} slug={slug} />}
      {canWriteScheme && (
        <EditSalarySchemeModal
          open={!!salarySchemeEmployee}
          onClose={() => setSalarySchemeEmployee(null)}
          slug={slug}
          employeeId={salarySchemeEmployee?.id ?? ""}
          employeeName={salarySchemeEmployee?.fullName}
        />
      )}
    </div>
  );
}

/** Ko'rsatkich tasmasidagi summa: raqam bir butun, valyuta kichik — sig'masa keyingi qatorga tushadi */
function StatMoney({ value }: { value: string | number }) {
  const [amount, currency] = [formatMoney(value).replace(/\s*UZS$/, ""), "UZS"];
  return (
    <>
      <span className="whitespace-nowrap">{amount}</span> <span className="text-[13px] font-medium text-[#8e8e93]">{currency}</span>
    </>
  );
}

const SCHEME_UNIT: Record<NonNullable<Employee["salaryScheme"]>["ruleType"], string> = {
  FIXED: "oy",
  PER_HOUR: "soat",
  PER_CHILD: "bola",
};

/** Maosh sxemasi: "2 500 000 UZS / oy" (yoki "Sxema yo'q") */
function SchemeText({ employee, className, prefix = "" }: { employee: Employee; className?: string; prefix?: string }) {
  const tr = useTr();
  const scheme = employee.salaryScheme;
  if (!scheme) {
    return <span className={className}>{prefix}{tr("Sxema yo'q")}</span>;
  }
  const amount = scheme.ruleType === "FIXED" ? scheme.fixedAmount : scheme.rate;
  return (
    <span className={className}>
      {prefix}
      <span className="tabular-nums">{formatMoney(amount)}</span> / {tr(SCHEME_UNIT[scheme.ruleType])}
    </span>
  );
}

/**
 * Xodim qatorining o'ng tomoni: maosh sxemasi (summa / oy, soat yoki bola)
 * va tanlangan oyning oyligi — to'langan, to'lanmagan yoki hali hisoblanmagan.
 * Telefonda joy tor: sxema izohga o'tadi, kapsulada faqat holat qoladi.
 */
function SalaryInfo({ employee, entry, loading }: { employee: Employee; entry: PayrollEntry | undefined; loading: boolean }) {
  const tr = useTr();
  return (
    <span className="flex flex-col items-end gap-1 text-right">
      <SchemeText
        employee={employee}
        className={employee.salaryScheme ? "whitespace-nowrap text-[14px] font-medium text-[var(--color-text)] max-sm:hidden" : "whitespace-nowrap text-[13px] text-[#8e8e93] max-sm:hidden"}
      />
      {loading ? (
        <span aria-hidden="true" className="h-6 w-24 animate-pulse rounded-full bg-[#767680]/[0.12] max-sm:hidden" />
      ) : entry ? (
        <Pill color={PAYROLL_STATUS_COLOR[entry.status]}>
          {tr(entry.status === "PAID" ? "To'langan" : "To'lanmagan")}
          <span className="max-sm:hidden">&nbsp;· {formatMoney(entry.totalAmount)}</span>
        </Pill>
      ) : (
        // Telefonda joy tor — hisoblanmagan holat ko'rsatilmaydi (hisoblanganlari ajralib turadi)
        <span className="max-sm:hidden">
          <Pill color={IOS.gray}>{tr("Hisoblanmagan")}</Pill>
        </span>
      )}
    </span>
  );
}
