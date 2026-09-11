"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Employee, Position } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CreateEmployeeModal } from "@/features/employees/create-employee-modal";
import { EmployeeDetailModal } from "@/features/employees/employee-detail-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { formatPositionLabel } from "@/lib/employee-position";

const OTHER_POSITION: Position = { id: "__other__", organizationId: "", name: "Boshqa", createdAt: "" };
const ALL_TAB = "__all__";

export default function EmployeesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [employeeModal, setEmployeeModal] = useState<{ open: boolean; position: Position | null }>({
    open: false,
    position: null,
  });
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const positionsQuery = useQuery({
    queryKey: ["positions", slug],
    queryFn: () => api.get<Position[]>("/app/positions"),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const groups = useMemo(() => {
    const positions = positionsQuery.data ?? [];
    const employees = employeesQuery.data ?? [];
    const byPosition = new Map<string, Employee[]>();
    for (const employee of employees) {
      const list = byPosition.get(employee.position) ?? [];
      list.push(employee);
      byPosition.set(employee.position, list);
    }

    const known = positions.map((position) => ({ position, employees: byPosition.get(position.name) ?? [] }));
    const knownNames = new Set(positions.map((p) => p.name));
    const orphanEmployees = employees.filter((e) => !knownNames.has(e.position));

    return orphanEmployees.length > 0
      ? [...known, { position: OTHER_POSITION, employees: orphanEmployees }]
      : known;
  }, [positionsQuery.data, employeesQuery.data]);

  const nonEmptyGroups = useMemo(() => groups.filter((group) => group.employees.length > 0), [groups]);
  const allEmployees = employeesQuery.data ?? [];

  const visibleEmployees = useMemo(() => {
    if (activeTab === ALL_TAB) return allEmployees;
    return nonEmptyGroups.find((group) => group.position.id === activeTab)?.employees ?? [];
  }, [activeTab, allEmployees, nonEmptyGroups]);

  const isLoading = positionsQuery.isLoading || employeesQuery.isLoading;
  const isError = positionsQuery.isError || employeesQuery.isError;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Xodimlar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Lavozimlar bo&apos;yicha guruhlangan xodimlar ro&apos;yxati</p>
        </div>
        {canWrite && (
          <Button variant="outline" onClick={() => setEmployeeModal({ open: true, position: null })}>
            + Yangi xodim
          </Button>
        )}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          message={
            (positionsQuery.error as Error | undefined)?.message ?? (employeesQuery.error as Error | undefined)?.message ?? ""
          }
        />
      ) : allEmployees.length === 0 ? (
        <EmptyState
          title="Hali xodim yo'q"
          description={canWrite ? "Yuqoridagi \"+ Yangi xodim\" tugmasi orqali birinchi xodimni qo'shing" : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto px-3 border-b border-[var(--color-separator)]">
            <button
              type="button"
              onClick={() => setActiveTab(ALL_TAB)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                activeTab === ALL_TAB
                  ? "border-[var(--color-primary)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              Barchasi
              <Badge tone={activeTab === ALL_TAB ? "primary" : "neutral"}>{allEmployees.length}</Badge>
            </button>
            {nonEmptyGroups.map(({ position, employees }) => (
              <button
                key={position.id}
                type="button"
                onClick={() => setActiveTab(position.id)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                  activeTab === position.id
                    ? "border-[var(--color-primary)] text-[var(--color-text)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {position.name}
                <Badge tone={activeTab === position.id ? "primary" : "neutral"}>{employees.length}</Badge>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {visibleEmployees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => setDetailEmployee(employee)}
                className="flex flex-col items-center gap-1.5 rounded-[var(--radius-lg)] p-2 text-center transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <EmployeePhoto
                  employee={employee}
                  size={64}
                  shape="circle"
                  fallback={initials(employee.fullName)}
                  className="text-[18px]"
                />
                <div className="min-w-0 w-full">
                  <p className="truncate text-[13px] font-medium text-[var(--color-text)]">
                    {employee.fullName}
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                    {formatPositionLabel(employee.position, employee.subjects)}
                  </p>
                </div>
                <Badge tone={employee.isActive ? "success" : "neutral"}>
                  {employee.isActive ? "Faol" : "Nofaol"}
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {canWrite && (
        <CreateEmployeeModal
          open={employeeModal.open}
          onClose={() => setEmployeeModal({ open: false, position: null })}
          slug={slug}
          initialPosition={employeeModal.position}
        />
      )}
      <EmployeeDetailModal
        open={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
        slug={slug}
        employee={detailEmployee}
        canWrite={canWrite}
      />
    </div>
  );
}
