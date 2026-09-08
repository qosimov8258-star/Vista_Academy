"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatDate, formatMoney } from "@/lib/format";
import { canWriteOperational } from "@/lib/permissions";
import {
  BellIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChecklistIcon,
  ChildIcon,
  GroupIcon,
  MealIcon,
  MoneyIcon,
  NoteIcon,
  PhoneIcon,
} from "@/components/ui/icons";

const QUICK_ACTIONS = [
  { label: "Arizalar (CRM)", icon: PhoneIcon, suffix: "crm" },
  { label: "Bolalar", icon: ChildIcon, suffix: "children" },
  { label: "Guruhlar", icon: GroupIcon, suffix: "groups" },
  { label: "Moliya", icon: MoneyIcon, suffix: "finance" },
  { label: "Davomat", icon: ChecklistIcon, suffix: "attendance" },
  { label: "Kundalik hisobot", icon: NoteIcon, suffix: "daily-reports" },
  { label: "Xodimlar davomati", icon: CalendarIcon, suffix: "staff-attendance" },
  { label: "Ovqatlanish", icon: MealIcon, suffix: "nutrition" },
  { label: "Ish haqi (HR)", icon: BriefcaseIcon, suffix: "hr" },
  { label: "Bildirishnomalar", icon: BellIcon, suffix: "notifications" },
];

export default function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug],
    queryFn: () => api.get<DashboardSummary>("/app/dashboard/summary"),
  });

  if (orgQuery.isLoading) return <LoadingState />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  const org = orgQuery.data;
  if (!org) return null;

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{org.name}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">/{org.slug}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--color-text-muted)]">Filiallar soni</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{org.branches.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--color-text-muted)]">Holat</p>
            <Badge tone={org.status === "ACTIVE" ? "success" : "danger"} className="mt-1">
              {org.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
            </Badge>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-[var(--color-text-muted)]">Yaratilgan</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{formatDate(org.createdAt)}</p>
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Statistika</h2>
        {summaryQuery.isLoading ? (
          <LoadingState />
        ) : summaryQuery.isError ? (
          <ErrorState message={(summaryQuery.error as Error).message} />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Jami bolalar soni</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.childrenCount ?? 0}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Faol guruhlar soni</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.activeGroupsCount ?? 0}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--color-text-muted)]">Xodimlar soni</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.employeesCount ?? 0}</p>
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Faol arizalar (CRM)</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.activeLeadsCount ?? 0}</p>
            </div>
            {!isNetworkAdmin && (
              <Link href={`/${slug}/crm`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                Ko&apos;rish →
              </Link>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Kutilayotgan bildirishnomalar</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{summary?.pendingNotificationsCount ?? 0}</p>
            </div>
            {!isNetworkAdmin && (
              <Link href={`/${slug}/notifications`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                Ko&apos;rish →
              </Link>
            )}
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Moliya ko&apos;rsatkichlari</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card>
            <CardBody>
              <p className="text-xs text-[var(--color-text-muted)]">Joriy oy tushumi</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">
                {formatMoney(summary?.monthRevenue ?? 0)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs text-[var(--color-text-muted)]">Qarzdorlik (to'lanishi kerak)</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">
                {formatMoney(summary?.outstandingDebt ?? 0)}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Bugungi holat</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card>
            <CardBody className="flex flex-col gap-2">
              <p className="text-xs text-[var(--color-text-muted)]">Kundalik hisobotlar to'ldirilgan</p>
              <p className="text-2xl font-semibold text-[var(--color-text)]">
                {summary?.todayDailyReportsFilled ?? 0} / {summary?.childrenCount ?? 0}
              </p>
              {!isNetworkAdmin && (
                <Link
                  href={`/${slug}/daily-reports`}
                  className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  {canWrite ? "To'ldirish →" : "Ko'rish →"}
                </Link>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-wrap items-center gap-8">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Bolalar — Keldi</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">
                  {summary?.todayAttendance.present ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Bolalar — Kelmadi</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">
                  {summary?.todayAttendance.absent ?? 0}
                </p>
              </div>
              {!isNetworkAdmin && (
                <Link
                  href={`/${slug}/attendance`}
                  className="ml-auto text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  {canWrite ? "Davomatni belgilash →" : "Ko'rish →"}
                </Link>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-wrap items-center gap-8">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Xodimlar — Keldi</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-success)]">
                  {summary?.todayStaffAttendance.present ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Xodimlar — Kelmadi</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">
                  {summary?.todayStaffAttendance.absent ?? 0}
                </p>
              </div>
              {!isNetworkAdmin && (
                <Link
                  href={`/${slug}/staff-attendance`}
                  className="ml-auto text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  {canWrite ? "Davomatni belgilash →" : "Ko'rish →"}
                </Link>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {!isNetworkAdmin && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Tezkor navigatsiya</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.suffix}
                  href={`/${slug}/${action.suffix}`}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 hover:shadow-[0_10px_28px_-8px_rgba(16,24,40,0.15)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-white">
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <span className="text-[13px] font-medium leading-tight text-[var(--color-text)]">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!isNetworkAdmin && (
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>So&apos;nggi filiallar</CardTitle>
          <Link href={`/${slug}/branches`} className="text-sm text-[var(--color-primary)] hover:underline">
            Barchasini ko&apos;rish →
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {org.branches.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Hali filial yo&apos;q</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {org.branches.slice(0, 5).map((branch) => (
                <li key={branch.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link
                      href={`/${slug}/branches/${branch.id}`}
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {branch.name}
                    </Link>
                    <p className="text-xs text-[var(--color-text-muted)]">{branch.address || "Manzil ko'rsatilmagan"}</p>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{branch.timezone}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      )}
    </div>
  );
}
