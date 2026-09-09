"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Employee, PayrollEntry, Shift } from "@/lib/types";
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
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";

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
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  // "Current period" depends on the viewer's clock, which can differ between
  // the server-rendered pass and the client hydration pass — computing it
  // lazily in an effect (client-only) avoids a hydration mismatch.
  const [period, setPeriod] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [payrollPage, setPayrollPage] = useState(1);
  const [logShiftOpen, setLogShiftOpen] = useState(false);
  const [generatePayrollOpen, setGeneratePayrollOpen] = useState(false);

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
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Ish haqi (HR)
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Xodimlar smenalari va ish haqi hisob-kitobi
          </p>
        </div>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">Davr</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
        <Select
          label="Xodim (smenalar uchun filtr)"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="sm:max-w-xs"
        >
          <option value="">Barcha xodimlar</option>
          {employeesQuery.data?.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Ish smenalari</CardTitle>
          {canWrite && <Button size="sm" onClick={() => setLogShiftOpen(true)}>+ Smena qo&apos;shish</Button>}
        </CardHeader>
        <CardBody className="p-0">
          {!period || shiftsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={4} />
            </div>
          ) : shiftsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(shiftsQuery.error as Error).message} />
            </div>
          ) : !shiftsQuery.data || shiftsQuery.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title="Bu davr uchun smena topilmadi"
                icon={<ClockIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Xodim</Th>
                  <Th>Sana</Th>
                  <Th numeric>Soat</Th>
                  <Th>Izoh</Th>
                </tr>
              </THead>
              <TBody>
                {shiftsQuery.data.map((shift) => (
                  <Tr key={shift.id}>
                    <Td className="font-medium">{employeeName(shift.employeeId)}</Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(shift.date)}</Td>
                    <Td numeric>{shift.hours}</Td>
                    <Td className="text-[var(--color-text-muted)]">{shift.note ?? "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Ish haqi</CardTitle>
          {canWrite && (
            <Button size="sm" onClick={() => setGeneratePayrollOpen(true)}>
              + Ish haqi hisoblash
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {!period || payrollQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={5} />
            </div>
          ) : payrollQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(payrollQuery.error as Error).message} />
            </div>
          ) : !payrollQuery.data || payrollQuery.data.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title="Bu davr uchun ish haqi hisoblanmagan"
                icon={<WalletIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <>
              <DataTable className="min-w-[880px]">
                <THead>
                  <tr>
                    <Th>Xodim</Th>
                    <Th>Davr</Th>
                    <Th numeric>Asosiy</Th>
                    <Th numeric>Mukofot</Th>
                    <Th numeric>Jarima</Th>
                    <Th numeric>Jami</Th>
                    <Th>Holat</Th>
                    <Th>To&apos;langan sana</Th>
                    <Th></Th>
                  </tr>
                </THead>
                <TBody>
                  {payrollQuery.data.data.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="font-medium">
                        {entry.employee?.fullName ?? employeeName(entry.employeeId)}
                      </Td>
                      <Td className="tabular-nums text-[var(--color-text-muted)]">{entry.period}</Td>
                      <Td numeric className="text-[var(--color-text-muted)]">
                        {formatMoney(entry.baseAmount)}
                      </Td>
                      <Td numeric className="text-[var(--color-success)]">{formatMoney(entry.bonusAmount)}</Td>
                      <Td numeric className="text-[var(--color-danger)]">{formatMoney(entry.penaltyAmount)}</Td>
                      <Td numeric className="font-medium">{formatMoney(entry.totalAmount)}</Td>
                      <Td>
                        <Badge tone={entry.status === "PAID" ? "success" : "warning"}>
                          {PAYROLL_STATUS_LABEL[entry.status]}
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
                            To&apos;landi deb belgilash
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </DataTable>

              {markPaidMutation.isError && (
                <div className="px-5 py-3.5 text-[13px] text-[var(--color-danger)] sm:px-6">
                  {markPaidMutation.error instanceof ApiError
                    ? markPaidMutation.error.message
                    : "Kutilmagan xatolik yuz berdi"}
                </div>
              )}

              <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
                <span className="tabular-nums">
                  Jami {payrollQuery.data.meta.total} ta, {payrollQuery.data.meta.page}-sahifa
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={payrollPage <= 1}
                    onClick={() => setPayrollPage((p) => p - 1)}
                  >
                    Oldingi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={payrollPage * payrollQuery.data.meta.limit >= payrollQuery.data.meta.total}
                    onClick={() => setPayrollPage((p) => p + 1)}
                  >
                    Keyingi
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
    </div>
  );
}
