"use client";

import { use } from "react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BranchReport, InvoiceStatus } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  ChildIcon,
  KeyIcon,
  MoneyIcon,
  SettingsIcon,
  TeacherIcon,
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

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: "default" | "success" | "danger";
}) {
  const valueTone =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-text)]";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-[var(--color-text-muted)]">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className={`mt-2 text-[26px] font-semibold leading-none tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </h2>
  );
}

export default function BranchReportPage({
  params,
}: {
  params: Promise<{ slug: string; branchId: string }>;
}) {
  const { slug, branchId } = use(params);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["branch-report", slug, branchId],
    queryFn: () => api.get<BranchReport>(`/app/dashboard/branch-report?branchId=${branchId}`),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  const { branch, children, groups, employees, finance } = data;
  const genderKnown = children.boys + children.girls;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/${slug}/branches`}
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Filiallar
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-[var(--color-text)]">
              {branch.name}
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
              {branch.address || "Manzil ko'rsatilmagan"} · {branch.timezone} · {formatDate(branch.createdAt)} dan
            </p>
          </div>
          <Link
            href={`/${slug}/branches/${branch.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <SettingsIcon className="h-4 w-4" />
            Sozlamalar
          </Link>
        </div>
      </div>

      <section>
        <SectionTitle>Tarbiyalanuvchilar</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Jami bolalar"
            value={children.active}
            icon={ChildIcon}
            hint={children.inactive > 0 ? `${children.inactive} ta nofaol` : "Faol holatdagilar"}
          />
          <StatTile
            label="O'g'il bolalar"
            value={children.boys}
            icon={ChildIcon}
            hint={genderKnown > 0 ? `${Math.round((children.boys / genderKnown) * 100)}%` : undefined}
          />
          <StatTile
            label="Qiz bolalar"
            value={children.girls}
            icon={ChildIcon}
            hint={genderKnown > 0 ? `${Math.round((children.girls / genderKnown) * 100)}%` : undefined}
          />
        </div>
        {genderKnown > 0 && (
          <Card className="mt-3 p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-[var(--color-text)]">O&apos;g&apos;il bolalar</span>
              <span className="tabular-nums text-[var(--color-text-muted)]">
                {children.boys} / {genderKnown}
              </span>
            </div>
            <ProgressBar value={children.boys} total={genderKnown} className="mt-2" />
            {children.unknownGender > 0 && (
              <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
                {children.unknownGender} ta bolaning jinsi ko&apos;rsatilmagan — ular bu nisbatga kirmaydi.
              </p>
            )}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Guruhlar</SectionTitle>
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>
              {groups.active} ta faol guruh · {groups.capacity} o&apos;rin
            </CardTitle>
            <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
              {children.active} / {groups.capacity} to&apos;lgan
            </span>
          </CardHeader>
          <CardBody className="p-0">
            {groups.items.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">
                Bu filialda hali guruh ochilmagan
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-separator)]">
                {groups.items.map((group) => (
                  <li key={group.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{group.name}</p>
                        <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                          {group.teachers.length > 0 ? group.teachers.join(", ") : "Tarbiyachi biriktirilmagan"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {group.status !== "ACTIVE" && <Badge tone="neutral">Nofaol</Badge>}
                        <span className="text-[13px] tabular-nums text-[var(--color-text)]">
                          {group.childrenCount} / {group.capacity}
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={group.childrenCount}
                      total={group.capacity}
                      tone={group.childrenCount >= group.capacity ? "warning" : "primary"}
                      className="mt-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionTitle>Xodimlar</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile label="Jami xodimlar" value={employees.total} icon={TeacherIcon} />
          <StatTile
            label="Faol"
            value={employees.active}
            icon={BriefcaseIcon}
            hint={employees.total - employees.active > 0 ? `${employees.total - employees.active} ta nofaol` : undefined}
          />
          <StatTile
            label="Kabineti bor"
            value={employees.withAccount}
            icon={KeyIcon}
            hint="Tizimga kira oladi"
          />
        </div>
        {employees.byPosition.length > 0 && (
          <Card className="mt-3 p-4">
            <p className="mb-2.5 text-[13px] font-medium text-[var(--color-text)]">Lavozimlar bo&apos;yicha</p>
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
            tone="success"
          />
          <StatTile
            label="Qarzdorlik"
            value={formatMoney(finance.outstandingDebt)}
            icon={MoneyIcon}
            tone={finance.outstandingDebt > 0 ? "danger" : "default"}
            hint={finance.outstandingDebt > 0 ? "To'lanishi kerak" : "Qarzdorlik yo'q"}
          />
        </div>
        <Card className="mt-3 overflow-hidden">
          <CardHeader>
            <CardTitle>Hisob-fakturalar holati</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {finance.invoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">
                Bu filialda hali hisob-faktura yaratilmagan
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[var(--color-surface-sunken)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Holat</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Soni</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Hisoblangan</th>
                      <th className="px-5 py-2.5 text-right font-semibold">To&apos;langan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-separator)]">
                    {finance.invoices.map((row) => (
                      <tr key={row.status}>
                        <td className="px-5 py-3">
                          <Badge tone={INVOICE_STATUS_TONE[row.status]}>
                            {INVOICE_STATUS_LABEL[row.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{row.count}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">
                          {formatMoney(row.billed)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[var(--color-success)]">
                          {formatMoney(row.paid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
