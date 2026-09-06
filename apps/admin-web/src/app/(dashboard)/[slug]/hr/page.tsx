"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Employee, PayrollEntry, Shift } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatMoney } from "@/lib/format";
import { LogShiftModal } from "@/features/hr/log-shift-modal";
import { GeneratePayrollModal } from "@/features/hr/generate-payroll-modal";
import { useBranchContext } from "@/lib/use-branch-context";

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
  const canWrite = user?.role !== "NETWORK_ADMIN";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Ish haqi (HR)</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Xodimlar smenalari va ish haqi hisob-kitobi</p>
        </div>
      </div>

      {!canWrite && <ViewOnlyNote />}

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Davr</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:w-auto"
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

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Ish smenalari</CardTitle>
          {canWrite && <Button size="sm" onClick={() => setLogShiftOpen(true)}>+ Smena qo&apos;shish</Button>}
        </CardHeader>
        <CardBody className="p-0">
          {!period || shiftsQuery.isLoading ? (
            <LoadingState />
          ) : shiftsQuery.isError ? (
            <ErrorState message={(shiftsQuery.error as Error).message} />
          ) : !shiftsQuery.data || shiftsQuery.data.length === 0 ? (
            <EmptyState title="Bu davr uchun smena topilmadi" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Xodim</th>
                    <th className="px-5 py-3 font-medium">Sana</th>
                    <th className="px-5 py-3 font-medium">Soat</th>
                    <th className="px-5 py-3 font-medium">Izoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {shiftsQuery.data.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-[var(--color-text)]">{employeeName(shift.employeeId)}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDate(shift.date)}</td>
                      <td className="px-5 py-3 text-[var(--color-text)]">{shift.hours}</td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{shift.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Ish haqi</CardTitle>
          {canWrite && (
            <Button size="sm" onClick={() => setGeneratePayrollOpen(true)}>
              + Ish haqi hisoblash
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {!period || payrollQuery.isLoading ? (
            <LoadingState />
          ) : payrollQuery.isError ? (
            <ErrorState message={(payrollQuery.error as Error).message} />
          ) : !payrollQuery.data || payrollQuery.data.data.length === 0 ? (
            <EmptyState title="Bu davr uchun ish haqi hisoblanmagan" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Xodim</th>
                      <th className="px-5 py-3 font-medium">Davr</th>
                      <th className="px-5 py-3 font-medium">Asosiy</th>
                      <th className="px-5 py-3 font-medium">Mukofot</th>
                      <th className="px-5 py-3 font-medium">Jarima</th>
                      <th className="px-5 py-3 font-medium">Jami</th>
                      <th className="px-5 py-3 font-medium">Holat</th>
                      <th className="px-5 py-3 font-medium">To&apos;langan sana</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {payrollQuery.data.data.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-[var(--color-text)]">
                          {entry.employee?.fullName ?? employeeName(entry.employeeId)}
                        </td>
                        <td className="px-5 py-3 text-[var(--color-text-muted)]">{entry.period}</td>
                        <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatMoney(entry.baseAmount)}</td>
                        <td className="px-5 py-3 text-[var(--color-success)]">{formatMoney(entry.bonusAmount)}</td>
                        <td className="px-5 py-3 text-[var(--color-danger)]">{formatMoney(entry.penaltyAmount)}</td>
                        <td className="px-5 py-3 font-medium text-[var(--color-text)]">{formatMoney(entry.totalAmount)}</td>
                        <td className="px-5 py-3">
                          <Badge tone={entry.status === "PAID" ? "success" : "warning"}>
                            {PAYROLL_STATUS_LABEL[entry.status]}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-[var(--color-text-muted)]">
                          {entry.paidAt ? formatDate(entry.paidAt) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canWrite && entry.status === "DRAFT" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={markPaidMutation.isPending && markPaidMutation.variables === entry.id}
                              onClick={() => markPaidMutation.mutate(entry.id)}
                            >
                              To&apos;landi deb belgilash
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {markPaidMutation.isError && (
                <div className="px-5 py-3 text-sm text-[var(--color-danger)]">
                  {markPaidMutation.error instanceof ApiError
                    ? markPaidMutation.error.message
                    : "Kutilmagan xatolik yuz berdi"}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-muted)]">
                <span>
                  Jami {payrollQuery.data.meta.total} ta, {payrollQuery.data.meta.page}-sahifa
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={payrollPage <= 1}
                    onClick={() => setPayrollPage((p) => p - 1)}
                  >
                    Oldingi
                  </Button>
                  <Button
                    variant="secondary"
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
