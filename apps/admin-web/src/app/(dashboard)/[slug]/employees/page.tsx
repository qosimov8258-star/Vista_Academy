"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, getPaginated } from "@/lib/api";
import type { Employee, PayrollEntry, Position } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CreateEmployeeModal } from "@/features/employees/create-employee-modal";
import { EmployeeDetailModal } from "@/features/employees/employee-detail-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational, canReadPayroll } from "@/lib/permissions";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { formatPositionLabel } from "@/lib/employee-position";
import { formatMoney } from "@/lib/format";

const OTHER_POSITION: Position = { id: "__other__", organizationId: "", name: "Boshqa", createdAt: "" };
const ALL_TAB = "__all__";
const PAID_TAB = "__paid__";
const UNPAID_TAB = "__unpaid__";
const BONUS_TAB = "__bonus__";
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
  const canViewPayroll = canReadPayroll(user?.role);
  const { branches } = useBranchContext(slug);
  const router = useRouter();
  // Moliyachi login/parolga tegmaydi — u xodim ustiga bossa, bola moliya
  // sahifasi kabi to'liq ekranli sahifaga o'tadi (davomat kalendari va oylik
  // to'lash), kichik oyna o'rniga.
  const isFinance = user?.role === "FINANCE";
  // `useBranchContext`ning `branchId`/`branchSlug`i shu sahifada ishonchsiz:
  // bu komponent `[slug]/[branchSlug]/employees` yo'li uchun qo'shni fayldan
  // qayta eksport qilinadi (pastroqdagi `[employeeId]` sahifasi ham xuddi
  // shunday), va Next navigatsiya paytida route params'ga filial segmentini
  // qo'shmay qolishi mumkin — natijada filial filtri butunlay yo'qoladi
  // (xodimlar ro'yxati tarmoq bo'ylab chiqadi) va "Xodimlar" havolasi filial
  // prefiksisiz qurilib, pastki panyeldagi faol holat ham o'chib qoladi. Shu
  // sabab filialni joriy `pathname`ning o'zidan aniqlaymiz — u har doim
  // haqiqiy URLni aks ettiradi.
  const pathname = usePathname();
  const pathBranchSlug = pathname.split("/").filter(Boolean)[1] ?? null;
  const forcedBranch = pathBranchSlug ? (branches.find((b) => b.slug === pathBranchSlug) ?? null) : null;
  const forcedBranchId = forcedBranch?.id ?? null;
  const employeeHref = (employeeId: string) => `${pathname.replace(/\/+$/, "")}/${employeeId}`;

  // Joriy oy klient soatiga bog'liq — serverda render qilingan pass bilan
  // hydration'da farq chiqmasligi uchun faqat effektda hisoblanadi.
  const [period, setPeriod] = useState("");
  useEffect(() => {
    setPeriod((current) => current || currentPeriodString());
  }, []);

  const positionsQuery = useQuery({
    queryKey: ["positions", slug],
    queryFn: () => api.get<Position[]>("/app/positions"),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const payrollQuery = useQuery({
    queryKey: ["payroll", slug, period, forcedBranchId],
    queryFn: () =>
      getPaginated<PayrollEntry>(
        `/app/payroll?page=1&limit=100&period=${period}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    enabled: canViewPayroll && !!period,
  });

  const payrollByEmployee = useMemo(() => {
    const map = new Map<string, PayrollEntry>();
    for (const entry of payrollQuery.data?.data ?? []) {
      map.set(entry.employeeId, entry);
    }
    return map;
  }, [payrollQuery.data]);

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

  const paidEmployees = useMemo(
    () => allEmployees.filter((employee) => payrollByEmployee.get(employee.id)?.status === "PAID"),
    [allEmployees, payrollByEmployee],
  );
  const unpaidEmployees = useMemo(
    () => allEmployees.filter((employee) => payrollByEmployee.get(employee.id)?.status !== "PAID"),
    [allEmployees, payrollByEmployee],
  );
  const bonusEmployees = useMemo(
    () => allEmployees.filter((employee) => Number(payrollByEmployee.get(employee.id)?.bonusAmount ?? 0) > 0),
    [allEmployees, payrollByEmployee],
  );

  const visibleEmployees = useMemo(() => {
    if (activeTab === ALL_TAB) return allEmployees;
    if (activeTab === PAID_TAB) return paidEmployees;
    if (activeTab === UNPAID_TAB) return unpaidEmployees;
    if (activeTab === BONUS_TAB) return bonusEmployees;
    return nonEmptyGroups.find((group) => group.position.id === activeTab)?.employees ?? [];
  }, [activeTab, allEmployees, nonEmptyGroups, paidEmployees, unpaidEmployees, bonusEmployees]);

  const isLoading = positionsQuery.isLoading || employeesQuery.isLoading;
  const isError = positionsQuery.isError || employeesQuery.isError;
  const isPayrollTab = activeTab === PAID_TAB || activeTab === UNPAID_TAB || activeTab === BONUS_TAB;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 md:flex-wrap md:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Xodimlar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Lavozimlar bo&apos;yicha guruhlangan xodimlar ro&apos;yxati</p>
        </div>
        {canWrite && (
          <Button variant="outline" className="shrink-0" onClick={() => setEmployeeModal({ open: true, position: null })}>
            + Yangi xodim
          </Button>
        )}
      </div>

      {!canWrite &&
        (canViewPayroll ? (
          <EmployeesStatsBar
            total={allEmployees.length}
            paid={paidEmployees.length}
            unpaid={unpaidEmployees.length}
            bonus={bonusEmployees.length}
          />
        ) : (
          <ViewOnlyNote role={user?.role} />
        ))}

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
            {canViewPayroll && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab(PAID_TAB)}
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                    activeTab === PAID_TAB
                      ? "border-[var(--color-primary)] text-[var(--color-text)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  Oylik to&apos;langan
                  <Badge tone={activeTab === PAID_TAB ? "primary" : "success"}>{paidEmployees.length}</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(UNPAID_TAB)}
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                    activeTab === UNPAID_TAB
                      ? "border-[var(--color-primary)] text-[var(--color-text)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  Oylik to&apos;lanmagan
                  <Badge tone={activeTab === UNPAID_TAB ? "primary" : "danger"}>{unpaidEmployees.length}</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(BONUS_TAB)}
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors",
                    activeTab === BONUS_TAB
                      ? "border-[var(--color-primary)] text-[var(--color-text)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  Bonuslar
                  <Badge tone={activeTab === BONUS_TAB ? "primary" : "info"}>{bonusEmployees.length}</Badge>
                </button>
                <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--color-separator)]" />
              </>
            )}
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

          {isPayrollTab && canViewPayroll && !payrollQuery.isLoading && visibleEmployees.length === 0 && (
            <div className="px-4 pt-4">
              <EmptyState
                title={
                  activeTab === BONUS_TAB
                    ? "Bu oyda bonus berilgan xodim yo'q"
                    : activeTab === PAID_TAB
                      ? "Bu oyda hali oylik to'langan xodim yo'q"
                      : "Bu oyda barcha xodimlarga oylik to'langan"
                }
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {visibleEmployees.map((employee) => {
              const payrollEntry = payrollByEmployee.get(employee.id);
              return (
              <button
                key={employee.id}
                type="button"
                onClick={() => (isFinance ? router.push(employeeHref(employee.id)) : setDetailEmployee(employee))}
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
                {activeTab === PAID_TAB ? (
                  <Badge tone="success">{formatMoney(payrollEntry?.totalAmount ?? 0)}</Badge>
                ) : activeTab === UNPAID_TAB ? (
                  <Badge tone="danger">To&apos;lanmagan</Badge>
                ) : activeTab === BONUS_TAB ? (
                  <Badge tone="info">{formatMoney(payrollEntry?.bonusAmount ?? 0)}</Badge>
                ) : (
                  <Badge tone={employee.isActive ? "success" : "neutral"}>
                    {employee.isActive ? "Faol" : "Nofaol"}
                  </Badge>
                )}
              </button>
              );
            })}
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
      {!isFinance && (
        <EmployeeDetailModal
          open={!!detailEmployee}
          onClose={() => setDetailEmployee(null)}
          slug={slug}
          employee={detailEmployee}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

/**
 * Yozish huquqi yo'q, ammo ish haqini ko'ra oladigan rollarga (Super Admin,
 * Moliyachi) "Faqat ko'rish rejimi" ogohlantirishi o'rniga ko'rsatiladi —
 * huquq yo'qligini takrorlashdan ko'ra, xodimlar bo'yicha oylik holati
 * taqsimoti foydaliroq.
 */
function EmployeesStatsBar({
  total,
  paid,
  unpaid,
  bonus,
}: {
  total: number;
  paid: number;
  unpaid: number;
  bonus: number;
}) {
  const tiles: { label: string; value: number; toneClass: string }[] = [
    { label: "Jami xodimlar", value: total, toneClass: "text-[var(--color-text)]" },
    { label: "Oylik to'langan", value: paid, toneClass: "text-[var(--color-success)]" },
    { label: "Oylik to'lanmagan", value: unpaid, toneClass: "text-[var(--color-danger)]" },
    { label: "Bonus olganlar", value: bonus, toneClass: "text-sky-700" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-[var(--color-separator)] sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-[var(--color-surface)] px-5 py-3.5 sm:px-6">
            <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tile.label}</p>
            <p className={`mt-1 text-[20px] font-semibold tabular-nums ${tile.toneClass}`}>{tile.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
