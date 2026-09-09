"use client";

import { use } from "react";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardSummary, Organization } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import {
  ArrowLeftIcon,
  BuildingIcon,
  CalendarIcon,
  ChecklistIcon,
  ChildIcon,
  GroupIcon,
  InfoIcon,
  MoneyIcon,
  NoteIcon,
  TeacherIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";

type Tone = "primary" | "success" | "danger";

/* 40px rangli uya plitkaning mavzusini bir qarashda beradi; raqam esa uning
   ostida katta va tabular-nums bilan teriladi — qiymat o'zgarganda ustunlar
   qimirlamaydi. Izoh qatori raqamdan keyin turadi: ko'z avval songa tushadi. */
const SLOT_TONE: Record<Tone, string> = {
  primary: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
};

const VALUE_TONE: Record<Tone, string> = {
  primary: "text-[var(--color-text)]",
  success: "text-[var(--color-success)]",
  danger: "text-[var(--color-danger)]",
};

function StatTile({
  icon: Icon,
  tone = "primary",
  size = "lg",
  value,
  label,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: Tone;
  size?: "lg" | "md";
  value: ReactNode;
  label: ReactNode;
}) {
  return (
    <Card>
      <CardBody>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] ${SLOT_TONE[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <p
          className={`mt-3.5 font-semibold leading-none tabular-nums ${
            size === "lg" ? "text-[26px]" : "text-[21px]"
          } ${VALUE_TONE[tone]}`}
        >
          {value}
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">{label}</p>
      </CardBody>
    </Card>
  );
}

/** Kelgan/kelmagan bir plitkada yonma-yon: ikkalasi ham bitta kunning holati. */
function AttendanceTile({
  icon: Icon,
  presentLabel,
  present,
  absentLabel,
  absent,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  presentLabel: string;
  present: number;
  absentLabel: string;
  absent: number;
}) {
  return (
    <Card>
      <CardBody>
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon className="h-5 w-5" />
        </span>
        <div className="mt-3.5 flex gap-8">
          <div>
            <p className="text-[26px] font-semibold leading-none tabular-nums text-[var(--color-success)]">
              {present}
            </p>
            <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">{presentLabel}</p>
          </div>
          <div>
            <p className="text-[26px] font-semibold leading-none tabular-nums text-[var(--color-danger)]">{absent}</p>
            <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">{absentLabel}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function BranchDashboardPage({ params }: { params: Promise<{ slug: string; branchSlug: string }> }) {
  const { slug, branchSlug } = use(params);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const branch = orgQuery.data?.branches.find((b) => b.slug === branchSlug) ?? null;

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", slug, branch?.id],
    queryFn: () => api.get<DashboardSummary>(`/app/dashboard/summary?branchId=${branch?.id}`),
    enabled: !!branch,
  });

  if (orgQuery.isLoading) return <LoadingState />;
  if (orgQuery.isError) return <ErrorState message={(orgQuery.error as Error).message} />;
  if (!branch) return <EmptyState title="Filial topilmadi" description="Bu manzilda bunday filial mavjud emas" />;

  const summary = summaryQuery.data;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/${slug}`}
          className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          Tarmoq bo&apos;yicha
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <BuildingIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
              {branch.name}
            </h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">{branch.address || "Manzil ko'rsatilmagan"}</p>
          </div>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : summaryQuery.isError ? (
        <ErrorState message={(summaryQuery.error as Error).message} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile icon={ChildIcon} value={summary?.childrenCount ?? 0} label="Bolalar soni" />
            <StatTile icon={GroupIcon} value={summary?.activeGroupsCount ?? 0} label="Faol guruhlar" />
            <StatTile icon={TeacherIcon} value={summary?.employeesCount ?? 0} label="Xodimlar soni" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              icon={MoneyIcon}
              tone="success"
              size="md"
              value={formatMoney(summary?.monthRevenue ?? 0)}
              label="Joriy oy tushumi"
            />
            <StatTile
              icon={WalletIcon}
              tone="danger"
              size="md"
              value={formatMoney(summary?.outstandingDebt ?? 0)}
              label="Qarzdorlik"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AttendanceTile
              icon={ChecklistIcon}
              presentLabel="Bolalar — Keldi"
              present={summary?.todayAttendance.present ?? 0}
              absentLabel="Kelmadi"
              absent={summary?.todayAttendance.absent ?? 0}
            />
            <AttendanceTile
              icon={CalendarIcon}
              presentLabel="Xodimlar — Keldi"
              present={summary?.todayStaffAttendance.present ?? 0}
              absentLabel="Kelmadi"
              absent={summary?.todayStaffAttendance.absent ?? 0}
            />
            <StatTile
              icon={NoteIcon}
              value={
                <>
                  {summary?.todayDailyReportsFilled ?? 0}{" "}
                  <span className="text-[17px] font-medium text-[var(--color-text-muted)]">
                    / {summary?.childrenCount ?? 0}
                  </span>
                </>
              }
              label={<>Kundalik hisobotlar to&apos;ldirilgan</>}
            />
          </div>

          <Card>
            <CardBody className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
                <InfoIcon className="h-[18px] w-[18px]" />
              </span>
              <p className="text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">
                Bu ko&apos;rsatkichlar faqat <span className="font-medium text-[var(--color-text)]">{branch.name}</span>{" "}
                filialiga tegishli. Ushbu filialning boshqaruv sozlamalarini{" "}
                <Link
                  href={`/${slug}/branches/${branch.id}`}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  bu yerda
                </Link>{" "}
                ko&apos;rishingiz mumkin.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
