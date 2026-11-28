"use client";

import { use, useEffect, useMemo, useState } from "react";
import { StaffTabs } from "@/features/employees/staff-tabs";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { Employee, PayrollEntry, Position } from "@/lib/types";
import { useAuth, useFeatureEnabled } from "@/lib/use-auth";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CreateEmployeeModal } from "@/features/employees/create-employee-modal";
import { EmployeeDetailModal } from "@/features/employees/employee-detail-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational, canReadPayroll } from "@/lib/permissions";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { IosButton } from "@/components/ios/button";
import { ChipRow, IosChip } from "@/components/ios/filters";
import { Group as IosGroup } from "@/components/ios/group";
import { MoneyIcon, PlusIcon, TeacherIcon } from "@/components/ios/icons";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_PRESS } from "@/components/ios/tokens";
import { formatPositionLabel } from "@/lib/employee-position";
import { formatDate, formatMoney } from "@/lib/format";
import { useTr } from "@/i18n/tr";

const OTHER_POSITION: Position = { id: "__other__", organizationId: "", name: "Boshqa", createdAt: "" };
const ALL_TAB = "__all__";
const PAID_TAB = "__paid__";
const UNPAID_TAB = "__unpaid__";
const BONUS_TAB = "__bonus__";
const ARCHIVE_TAB = "__archive__";
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
  const tr = useTr();
  const { slug } = use(params);
  const [employeeModal, setEmployeeModal] = useState<{ open: boolean; position: Position | null }>({
    open: false,
    position: null,
  });
  // Varaq ro'yxatdagi xodimni id bo'yicha oladi — tahrirlangach (ro'yxat
  // qayta yuklanganda) varaqda ham yangi ma'lumot ko'rinadi
  const [detailId, setDetailId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  // Ish haqi — «Ish haqi (HR)» funksiyasi; o'chirilgan bo'lsa so'ralmaydi va ko'rinmaydi
  const isOn = useFeatureEnabled();
  const canViewPayroll = canReadPayroll(user?.role) && isOn("hr");
  const canCreate = canWrite && isOn("employeeCreate");
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

  // Arxiv: ishdan ketgan xodimlar — tarixi saqlangan, qaytarish yoki o'chirish mumkin
  const archivedQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId, "archived"],
    queryFn: () => api.get<Employee[]>(`/app/employees?archived=only${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`),
  });
  const archivedEmployees = useMemo(() => archivedQuery.data ?? [], [archivedQuery.data]);

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
  const detailEmployee = detailId
    ? (allEmployees.find((e) => e.id === detailId) ?? archivedEmployees.find((e) => e.id === detailId) ?? null)
    : null;

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
    if (activeTab === ARCHIVE_TAB) return archivedEmployees;
    return nonEmptyGroups.find((group) => group.position.id === activeTab)?.employees ?? [];
  }, [activeTab, allEmployees, nonEmptyGroups, paidEmployees, unpaidEmployees, bonusEmployees, archivedEmployees]);

  const isLoading = positionsQuery.isLoading || employeesQuery.isLoading;
  const isError = positionsQuery.isError || employeesQuery.isError;
  const isPayrollTab = activeTab === PAID_TAB || activeTab === UNPAID_TAB || activeTab === BONUS_TAB;
  // Arxiv bo'shab qolsa ham (oxirgisi qaytarilsa) tanlangan filtr yo'qolib qolmasin
  const showArchiveChip = archivedEmployees.length > 0 || activeTab === ARCHIVE_TAB;

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <StaffTabs slug={slug} role={user?.role} current="list" />
        <PageHeaderCard
          icon={TeacherIcon}
          title={tr("Xodimlar")}
          count={employeesQuery.data ? tr("{0} ta", allEmployees.length) : undefined}
          subtitle={tr("Lavozimlar bo'yicha guruhlangan xodimlar ro'yxati")}
          actions={
            canCreate ? (
              <IosButton
                label={tr("Yangi xodim")}
                icon={PlusIcon}
                variant="primary"
                compact
                onClick={() => setEmployeeModal({ open: true, position: null })}
              />
            ) : undefined
          }
        />

        {!canWrite &&
          (canViewPayroll ? (
            <StatStrip>
              <StatCell label={tr("Jami xodimlar")} value={allEmployees.length} loading={employeesQuery.isLoading} />
              <StatCell label={tr("Oylik to'langan")} value={paidEmployees.length} color={IOS.green} loading={employeesQuery.isLoading || payrollQuery.isLoading} />
              <StatCell label={tr("Oylik to'lanmagan")} value={unpaidEmployees.length} color={IOS.red} loading={employeesQuery.isLoading || payrollQuery.isLoading} />
              <StatCell label={tr("Bonus olganlar")} value={bonusEmployees.length} color={IOS.blue} loading={employeesQuery.isLoading || payrollQuery.isLoading} />
            </StatStrip>
          ) : (
            <ViewOnlyNote role={user?.role} />
          ))}

        {isLoading ? (
          <SkeletonRows rows={7} />
        ) : isError ? (
          <ErrorState
            message={(positionsQuery.error as Error | undefined)?.message ?? (employeesQuery.error as Error | undefined)?.message}
            onRetry={() => {
              void positionsQuery.refetch();
              void employeesQuery.refetch();
            }}
            retrying={positionsQuery.isFetching || employeesQuery.isFetching}
          />
        ) : allEmployees.length === 0 && archivedEmployees.length === 0 ? (
          <EmptyState
            icon={TeacherIcon}
            title="Hali xodim yo'q"
            hint={canCreate ? "«Yangi xodim» tugmasi orqali birinchi xodimni qo'shing" : undefined}
          />
        ) : (
          <>
            {/* Filtr: oylik holati, lavozimlar, arxiv — bittasi tanlanadi */}
            <ChipRow label={tr("Xodimlar filtri")}>
              <IosChip active={activeTab === ALL_TAB} onClick={() => setActiveTab(ALL_TAB)} count={allEmployees.length}>
                {tr("Barchasi")}
              </IosChip>
              {canViewPayroll && (
                <>
                  <IosChip active={activeTab === PAID_TAB} onClick={() => setActiveTab(PAID_TAB)} count={paidEmployees.length}>
                    {tr("Oylik to'langan")}
                  </IosChip>
                  <IosChip active={activeTab === UNPAID_TAB} onClick={() => setActiveTab(UNPAID_TAB)} count={unpaidEmployees.length}>
                    {tr("Oylik to'lanmagan")}
                  </IosChip>
                  <IosChip active={activeTab === BONUS_TAB} onClick={() => setActiveTab(BONUS_TAB)} count={bonusEmployees.length}>
                    {tr("Bonuslar")}
                  </IosChip>
                </>
              )}
              {nonEmptyGroups.map(({ position, employees }) => (
                <IosChip key={position.id} active={activeTab === position.id} onClick={() => setActiveTab(position.id)} count={employees.length}>
                  {tr(position.name)}
                </IosChip>
              ))}
              {showArchiveChip && (
                <IosChip active={activeTab === ARCHIVE_TAB} onClick={() => setActiveTab(ARCHIVE_TAB)} count={archivedEmployees.length}>
                  {tr("Arxiv")}
                </IosChip>
              )}
            </ChipRow>

            <IosGroup
              footer={
                activeTab === ARCHIVE_TAB && archivedEmployees.length > 0
                  ? tr("Ishdan ketgan xodimlar. Davomat, oylik va boshqa tarixi saqlangan — xodimni bosib ishga qaytaring yoki to'liq ma'lumotini ko'ring.")
                  : undefined
              }
              bare
            >
              {(isPayrollTab && payrollQuery.isLoading) || (activeTab === ARCHIVE_TAB && archivedQuery.isLoading) ? (
                <SkeletonRows rows={5} />
              ) : visibleEmployees.length === 0 ? (
                <EmptyState
                  icon={isPayrollTab ? MoneyIcon : TeacherIcon}
                  title={
                    activeTab === BONUS_TAB
                      ? "Bu oyda bonus berilgan xodim yo'q"
                      : activeTab === PAID_TAB
                        ? "Bu oyda hali oylik to'langan xodim yo'q"
                        : activeTab === UNPAID_TAB
                          ? "Bu oyda barcha xodimlarga oylik to'langan"
                          : activeTab === ARCHIVE_TAB
                            ? "Arxiv bo'sh"
                            : "Xodim topilmadi"
                  }
                />
              ) : (
                <div className="ios-snow">
                  <div className={`${GROUP_BLOCK} grid grid-cols-3 gap-1 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8`}>
                    {visibleEmployees.map((employee) => {
                      const payrollEntry = payrollByEmployee.get(employee.id);
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => (isFinance ? router.push(employeeHref(employee.id)) : setDetailId(employee.id))}
                          className={`flex min-w-0 flex-col items-center gap-1.5 rounded-[14px] px-1.5 py-2.5 text-center ${ROW_PRESS}`}
                        >
                          <EmployeePhoto employee={employee} size={64} shape="circle" fallback={initials(employee.fullName)} className="text-[20px]" />
                          <span className="w-full min-w-0">
                            <span className="block truncate text-[13.5px] font-medium text-[var(--color-text)]">{tr(employee.fullName)}</span>
                            <span className="block truncate text-[12px] text-[#8e8e93]">{tr(formatPositionLabel(employee.position, employee.subjects))}</span>
                          </span>
                          {activeTab === PAID_TAB ? (
                            <Pill color={IOS.green}>{formatMoney(payrollEntry?.totalAmount ?? 0)}</Pill>
                          ) : activeTab === UNPAID_TAB ? (
                            <Pill color={IOS.red}>{tr("To'lanmagan")}</Pill>
                          ) : activeTab === BONUS_TAB ? (
                            <Pill color={IOS.blue}>{formatMoney(payrollEntry?.bonusAmount ?? 0)}</Pill>
                          ) : !employee.isActive ? (
                            <Pill color={IOS.orange}>{employee.archivedAt ? formatDate(employee.archivedAt) : tr("Arxivda")}</Pill>
                          ) : (
                            <Pill color={IOS.green}>{tr("Faol")}</Pill>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </IosGroup>
          </>
        )}
      </div>

      {canCreate && (
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
          onClose={() => setDetailId(null)}
          slug={slug}
          employee={detailEmployee}
          canWrite={canWrite}
          profileHref={detailEmployee && !detailEmployee.isActive ? employeeHref(detailEmployee.id) : undefined}
        />
      )}
    </div>
  );
}
