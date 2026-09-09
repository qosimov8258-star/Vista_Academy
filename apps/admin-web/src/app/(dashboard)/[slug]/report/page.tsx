"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BranchReport, InvoiceStatus, Organization } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import {
  BriefcaseIcon,
  BuildingIcon,
  ChildIcon,
  GroupIcon,
  KeyIcon,
  MoneyIcon,
  SettingsIcon,
  TeacherIcon,
  WalletIcon,
} from "@/components/ui/icons";

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  PENDING: "Kutilmoqda",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "To'langan",
  OVERDUE: "Muddati o'tgan",
  CANCELLED: "Bekor qilingan",
};

const INVOICE_STATUS_TONE: Record<InvoiceStatus, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

/**
 * iOS'ning sog'liq/statistika kartalari uslubida: yuqorida rangli ikonka va
 * yozuv bir qatorda, ostida yirik raqam, kerak bo'lsa yupqa o'lchov chizig'i.
 * Blur yo'q — oq yuza, ingichka chegara va deyarli sezilmas soya.
 */
type TileTint = "brand" | "sky" | "rose" | "success" | "danger" | "neutral";

const TINT_ICON: Record<TileTint, string> = {
  brand: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-500",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
};

const TINT_METER: Record<TileTint, string> = {
  brand: "bg-[var(--color-primary)]",
  sky: "bg-sky-500",
  rose: "bg-rose-400",
  success: "bg-[var(--color-success)]",
  danger: "bg-[var(--color-danger)]",
  neutral: "bg-[var(--color-text-muted)]",
};

const TINT_VALUE: Record<TileTint, string> = {
  brand: "text-[var(--color-text)]",
  sky: "text-[var(--color-text)]",
  rose: "text-[var(--color-text)]",
  success: "text-[var(--color-success)]",
  danger: "text-[var(--color-danger)]",
  neutral: "text-[var(--color-text)]",
};

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tint = "neutral",
  meter,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tint?: TileTint;
  /** Ulushni ko'rsatuvchi yupqa chiziq — raqamning kontekstini beradi. */
  meter?: { value: number; total: number };
}) {
  const percent = meter && meter.total > 0 ? Math.round((meter.value / meter.total) * 100) : null;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-[18px] shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${TINT_ICON[tint]}`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="min-w-0 truncate text-[13px] font-medium text-[var(--color-text-muted)]">{label}</p>
      </div>

      <p
        className={`mt-3.5 text-[32px] font-semibold leading-none tracking-[var(--tracking-title)] tabular-nums ${TINT_VALUE[tint]}`}
      >
        {value}
      </p>

      {percent !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)] ${TINT_METER[tint]}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}

      {hint && <p className="mt-2.5 text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

/**
 * Guruhlar bir-biridan rang bilan ajraladi. Rang guruh ro'yxatdagi o'rniga
 * qarab beriladi — ma'no tashimaydi, faqat bir xil kulrang qatorlar o'rniga
 * har birini alohida ko'rinadigan qiladi.
 */
const GROUP_PALETTE = [
  { ring: "stroke-emerald-500", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  { ring: "stroke-sky-500", chip: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  { ring: "stroke-violet-500", chip: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  { ring: "stroke-amber-500", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  { ring: "stroke-rose-400", chip: "bg-rose-50 text-rose-600", dot: "bg-rose-400" },
  { ring: "stroke-teal-500", chip: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
];

/**
 * To'lganlik halqasi. Yupqa chiziqdan farqi — o'rtada raqam turadi va
 * nisbat bir qarashda ko'rinadi, o'qishga hojat qolmaydi.
 */
function CapacityRing({
  value,
  total,
  ringClass,
}: {
  value: number;
  total: number;
  ringClass: string;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(1, value / total) : 0;

  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-[var(--color-surface-sunken)]"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={`${ringClass} transition-[stroke-dashoffset] duration-700 ease-[var(--ease-out)]`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[17px] font-semibold leading-none tabular-nums text-[var(--color-text)]">
          {value}
        </span>
        <span className="mt-0.5 text-[10px] leading-none text-[var(--color-text-muted)]">/ {total}</span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 px-0.5 text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
      {children}
    </h2>
  );
}

export default function BranchReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const branches = orgQuery.data?.branches ?? [];
  // Filial tanlanmagan bo'lsa birinchisi olinadi — bitta filialli tarmoqda
  // tanlash bilan ovora bo'lishning hojati yo'q.
  const branchId = selectedBranchId ?? branches[0]?.id ?? null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["branch-report", slug, branchId],
    queryFn: () => api.get<BranchReport>(`/app/dashboard/branch-report?branchId=${branchId}`),
    enabled: Boolean(branchId),
  });

  if (orgQuery.isLoading || (branchId && isLoading)) return <LoadingState rows={5} />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!branchId) {
    return (
      <EmptyState
        title="Filial yo'q"
        description="Ma'lumotlar chiqishi uchun avval filial oching"
        icon={<BuildingIcon className="h-[26px] w-[26px]" />}
      />
    );
  }
  if (!data) return null;

  const { branch, children, groups, employees, finance } = data;
  const genderKnown = children.boys + children.girls;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
              Ma&apos;lumotlar
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
              {branch.name} · {branch.address || "Manzil ko'rsatilmagan"} · {formatDate(branch.createdAt)} dan
            </p>
          </div>
          <Link
            href={`/${slug}/branches/${branch.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-text)] shadow-[var(--shadow-xs)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-surface-hover)]"
          >
            <SettingsIcon className="h-4 w-4" />
            Filial sozlamalari
          </Link>
        </div>

        {/* Bir nechta filial bo'lsa tanlash kerak; bittada tanlagich ortiqcha */}
        {branches.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {branches.map((item) => {
              const active = item.id === branchId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedBranchId(item.id)}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <section>
        <SectionTitle>Tarbiyalanuvchilar</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Jami bolalar"
            value={children.active}
            icon={ChildIcon}
            tint="brand"
            hint={children.inactive > 0 ? `${children.inactive} ta nofaol` : "Faol holatdagilar"}
          />
          <StatTile
            label="O'g'il bolalar"
            value={children.boys}
            icon={ChildIcon}
            tint="sky"
            meter={genderKnown > 0 ? { value: children.boys, total: genderKnown } : undefined}
            hint={
              genderKnown > 0 ? `${Math.round((children.boys / genderKnown) * 100)}% — ${genderKnown} tadan` : undefined
            }
          />
          <StatTile
            label="Qiz bolalar"
            value={children.girls}
            icon={ChildIcon}
            tint="rose"
            meter={genderKnown > 0 ? { value: children.girls, total: genderKnown } : undefined}
            hint={
              genderKnown > 0 ? `${Math.round((children.girls / genderKnown) * 100)}% — ${genderKnown} tadan` : undefined
            }
          />
        </div>
        {children.unknownGender > 0 && (
          <p className="mt-2.5 px-1 text-[12px] text-[var(--color-text-muted)]">
            {children.unknownGender} ta bolaning jinsi ko&apos;rsatilmagan — ular bu nisbatga kirmaydi.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Guruhlar</SectionTitle>

        {/* Umumiy to'lganlik: guruhlar bo'yicha bo'lingan yagona chiziq */}
        <div className="mb-3 rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
              {groups.active} ta faol guruh
              <span className="ml-2 text-[13px] font-normal text-[var(--color-text-muted)]">
                {groups.capacity} o&apos;rin
              </span>
            </p>
            <p className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
              {children.active} / {groups.capacity} to&apos;lgan
              {groups.capacity > 0 && (
                <span className="ml-2 font-medium text-[var(--color-text)]">
                  {Math.round((children.active / groups.capacity) * 100)}%
                </span>
              )}
            </p>
          </div>
          <div className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
            {groups.items.map((group, index) => {
              const share = groups.capacity > 0 ? (group.childrenCount / groups.capacity) * 100 : 0;
              if (share === 0) return null;
              return (
                <span
                  key={group.id}
                  className={`h-full ${GROUP_PALETTE[index % GROUP_PALETTE.length].dot}`}
                  style={{ width: `${share}%` }}
                  title={`${group.name}: ${group.childrenCount}`}
                />
              );
            })}
          </div>
        </div>

        {groups.items.length === 0 ? (
          <EmptyState
            title="Bu filialda hali guruh ochilmagan"
            icon={<GroupIcon className="h-[26px] w-[26px]" />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.items.map((group, index) => {
              const palette = GROUP_PALETTE[index % GROUP_PALETTE.length];
              const free = Math.max(0, group.capacity - group.childrenCount);
              const isFull = free === 0 && group.capacity > 0;
              const isEmpty = group.childrenCount === 0;

              return (
                <div
                  key={group.id}
                  className={`rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-[18px] shadow-[var(--shadow-card)] ${
                    group.status === "ACTIVE" ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <CapacityRing value={group.childrenCount} total={group.capacity} ringClass={palette.ring} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 text-[15px] font-semibold leading-tight tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                          {group.name}
                        </h3>
                        {group.status !== "ACTIVE" && (
                          <Badge tone="neutral" className="shrink-0">
                            Nofaol
                          </Badge>
                        )}
                      </div>

                      {/* Tarbiyachi — bosh harflari bilan, biriktirilmagani ko'zga tashlanadi */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.teachers.length > 0 ? (
                          group.teachers.map((teacher) => (
                            <span
                              key={teacher}
                              className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] font-medium ${palette.chip}`}
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[10px] font-semibold">
                                {teacher
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part) => part[0]?.toUpperCase() ?? "")
                                  .join("")}
                              </span>
                              {teacher}
                            </span>
                          ))
                        ) : (
                          <Badge tone="warning">Tarbiyachi biriktirilmagan</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="hairline mt-3.5 border-t border-[var(--color-separator)] pt-3 text-[12.5px] text-[var(--color-text-muted)]">
                    {isFull ? (
                      <span className="font-medium text-[var(--color-text)]">Guruh to&apos;lgan</span>
                    ) : isEmpty ? (
                      <>Hali bola qo&apos;shilmagan — {group.capacity} o&apos;rin bo&apos;sh</>
                    ) : (
                      <>
                        <span className="font-medium text-[var(--color-text)]">{free}</span> o&apos;rin bo&apos;sh
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Xodimlar</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile label="Jami xodimlar" value={employees.total} icon={TeacherIcon} tint="brand" />
          <StatTile
            label="Faol"
            value={employees.active}
            icon={BriefcaseIcon}
            tint="success"
            meter={employees.total > 0 ? { value: employees.active, total: employees.total } : undefined}
            hint={employees.total - employees.active > 0 ? `${employees.total - employees.active} ta nofaol` : undefined}
          />
          <StatTile
            label="Kabineti bor"
            value={employees.withAccount}
            icon={KeyIcon}
            tint="neutral"
            meter={employees.total > 0 ? { value: employees.withAccount, total: employees.total } : undefined}
            hint="Tizimga kira oladi"
          />
        </div>
        {employees.byPosition.length > 0 && (
          <Card className="mt-3 p-[18px]">
            <p className="mb-2.5 text-[14px] font-medium text-[var(--color-text)]">Lavozimlar bo&apos;yicha</p>
            <div className="flex flex-wrap gap-2">
              {employees.byPosition.map((row) => (
                <span
                  key={row.position}
                  className="rounded-full bg-[var(--color-surface-sunken)] px-3 py-1.5 text-[13px] text-[var(--color-text)]"
                >
                  {row.position}
                  <span className="ml-1.5 tabular-nums text-[var(--color-text-muted)]">{row.count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>To&apos;lovlar</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile
            label="Joriy oy tushumi"
            value={formatMoney(finance.monthRevenue)}
            icon={MoneyIcon}
            tint="success"
          />
          <StatTile
            label="Qarzdorlik"
            value={formatMoney(finance.outstandingDebt)}
            icon={MoneyIcon}
            tint={finance.outstandingDebt > 0 ? "danger" : "neutral"}
            hint={finance.outstandingDebt > 0 ? "To'lanishi kerak" : "Qarzdorlik yo'q"}
          />
        </div>
        <Card className="mt-3 overflow-hidden">
          <CardHeader>
            <CardTitle>Hisob-fakturalar holati</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {finance.invoices.length === 0 ? (
              <EmptyState
                title="Bu filialda hali hisob-faktura yaratilmagan"
                icon={<WalletIcon className="h-[26px] w-[26px]" />}
              />
            ) : (
              <DataTable className="min-w-[520px]">
                <THead>
                  <tr>
                    <Th>Holat</Th>
                    <Th numeric>Soni</Th>
                    <Th numeric>Hisoblangan</Th>
                    <Th numeric>To&apos;langan</Th>
                  </tr>
                </THead>
                <TBody>
                  {finance.invoices.map((row) => (
                    <Tr key={row.status}>
                      <Td>
                        <Badge tone={INVOICE_STATUS_TONE[row.status]}>
                          {INVOICE_STATUS_LABEL[row.status]}
                        </Badge>
                      </Td>
                      <Td numeric>{row.count}</Td>
                      <Td numeric>{formatMoney(row.billed)}</Td>
                      <Td numeric className="text-[var(--color-success)]">
                        {formatMoney(row.paid)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </DataTable>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
