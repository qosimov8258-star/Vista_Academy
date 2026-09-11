"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Group, GroupOverview, GroupAttendanceRange, GroupAttendanceDay } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ArrowLeftIcon, GroupIcon, TeacherIcon } from "@/components/ui/icons";
import { initials } from "@/components/ui/avatar";
import { formatAge, formatChildId, formatDate, formatGender } from "@/lib/format";
import { canWriteOperational } from "@/lib/permissions";
import { EditGroupModal } from "@/features/groups/edit-group-modal";
import { ManageTeachersModal } from "@/features/groups/manage-teachers-modal";

const CHILD_STATUS_LABEL: Record<string, string> = { ACTIVE: "Faol", INACTIVE: "Nofaol", QUARANTINED: "Karantinda" };
const CHILD_STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  QUARANTINED: "danger",
};
const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: "Keldi",
  ABSENT: "Kelmadi",
  LATE: "Kech qoldi",
  SICK: "Kasal",
};
const ATTENDANCE_STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  SICK: "warning",
};
const DEFAULT_TIMEZONE = "Asia/Tashkent";
const RANGE_PRESETS = [
  { days: 7, label: "7 kun" },
  { days: 14, label: "14 kun" },
  { days: 30, label: "30 kun" },
];

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Filtr-pilla — CRM va Administratorlar sahifalarida ishlatilgan uslub bilan bir xil. */
function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}

export default function GroupDetailPage({ params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const { slug, groupId } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const [editOpen, setEditOpen] = useState(false);
  const [teachersOpen, setTeachersOpen] = useState(false);
  // Sana mijoz soatiga bog'liq — birinchi renderda emas, effektda hisoblanadi,
  // aks holda server va brauzer HTML'i mos kelmaydi.
  const [rosterDate, setRosterDate] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const today = todayDateString();
    setRosterDate((current) => current ?? today);
    setRange((current) => current ?? { from: shiftDays(today, -13), to: today });
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["group-overview", slug, groupId],
    queryFn: () => api.get<GroupOverview>(`/app/groups/${groupId}/overview`),
  });

  const rosterQuery = useQuery({
    queryKey: ["group-day", slug, groupId, rosterDate],
    queryFn: () => api.get<GroupAttendanceDay>(`/app/groups/${groupId}/attendance/day?date=${rosterDate}`),
    enabled: !!rosterDate,
  });

  const attendanceQuery = useQuery({
    queryKey: ["group-attendance-range", slug, groupId, range?.from, range?.to],
    queryFn: () =>
      api.get<GroupAttendanceRange>(`/app/groups/${groupId}/attendance?from=${range!.from}&to=${range!.to}`),
    enabled: !!range,
  });

  if (overviewQuery.isLoading) return <LoadingState />;
  if (overviewQuery.isError) return <ErrorState message={(overviewQuery.error as Error).message} />;
  const overview = overviewQuery.data;
  if (!overview) return null;

  // Modal `Group` shaklini kutadi — overview'dagi qismlardan yig'ib beramiz.
  const groupForModals: Group = {
    id: overview.group.id,
    branchId: overview.branch.id,
    name: overview.group.name,
    capacity: overview.group.capacity,
    status: overview.group.status,
    createdAt: overview.group.createdAt,
  };

  return (
    <div className="space-y-5">
      <Link
        href={`/${slug}/groups`}
        className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        Guruhlar
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
                {overview.group.name}
              </h1>
              <Badge tone={overview.group.status === "ACTIVE" ? "success" : "neutral"}>
                {overview.group.status === "ACTIVE" ? "Faol" : "Nofaol"}
              </Badge>
            </div>
            <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">{overview.branch.name}</p>
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setTeachersOpen(true)}>
                Tarbiyachilar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                Tahrirlash
              </Button>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--color-separator)] border-t border-[var(--color-separator)] sm:grid-cols-5 sm:divide-y-0">
          <div className="px-5 py-3.5 sm:px-6">
            <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Bolalar / Sig&apos;im</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">
              {overview.children.active} / {overview.group.capacity}
            </dd>
          </div>
          <div className="px-5 py-3.5 sm:px-6">
            <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Bo&apos;sh o&apos;rin</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">
              {Math.max(0, overview.group.capacity - overview.children.active)}
            </dd>
          </div>
          <div className="px-5 py-3.5 sm:px-6">
            <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">O&apos;g&apos;il bolalar</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">{overview.children.boys}</dd>
          </div>
          <div className="px-5 py-3.5 sm:px-6">
            <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Qiz bolalar</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">{overview.children.girls}</dd>
          </div>
          <div className="px-5 py-3.5 sm:px-6">
            <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Tarbiyachilar</dt>
            <dd className="mt-1 text-[15px] font-medium tabular-nums text-[var(--color-text)]">{overview.teachers.length}</dd>
          </div>
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <CardTitle>Kim keldi</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {rosterDate && (
              <>
                <FilterPill active={rosterDate === todayDateString()} onClick={() => setRosterDate(todayDateString())}>
                  Bugun
                </FilterPill>
                <FilterPill
                  active={rosterDate === shiftDays(todayDateString(), -1)}
                  onClick={() => setRosterDate(shiftDays(todayDateString(), -1))}
                >
                  Kecha
                </FilterPill>
              </>
            )}
            <input
              type="date"
              value={rosterDate ?? ""}
              max={todayDateString()}
              onChange={(e) => e.target.value && setRosterDate(e.target.value)}
              aria-label="Sana"
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {!rosterDate || rosterQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : rosterQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(rosterQuery.error as Error).message} />
            </div>
          ) : !rosterQuery.data || rosterQuery.data.total === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState title="Bu guruhda faol bola yo'q" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-[var(--color-separator)] border-b border-[var(--color-separator)]">
                <RosterCount label="Keldi" value={rosterQuery.data.counts.present} tone="success" />
                <RosterCount label="Kelmadi" value={rosterQuery.data.counts.absent} tone="danger" />
                <RosterCount label="Belgilanmagan" value={rosterQuery.data.counts.unmarked} tone="neutral" />
              </div>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Ism</Th>
                    <Th>Holat</Th>
                    <Th>Izoh</Th>
                  </tr>
                </THead>
                <TBody>
                  {rosterQuery.data.items.map((item) => (
                    <Tr key={item.childId}>
                      <Td className="font-medium">
                        <Link href={`/${slug}/children/${item.childId}`} className="text-[var(--color-primary)] hover:underline">
                          {item.fullName}
                        </Link>
                        <span className="ml-1.5 text-[12px] text-[var(--color-text-muted)]">{formatChildId(item.publicId)}</span>
                      </Td>
                      <Td>
                        {item.status ? (
                          <Badge tone={ATTENDANCE_STATUS_TONE[item.status]}>{ATTENDANCE_STATUS_LABEL[item.status]}</Badge>
                        ) : (
                          <Badge tone="neutral">Belgilanmagan</Badge>
                        )}
                      </Td>
                      <Td className="text-[var(--color-text-muted)]">{item.note ?? "—"}</Td>
                    </Tr>
                  ))}
                </TBody>
              </DataTable>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Tarbiyachilar</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {overview.teachers.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title="Hali tarbiyachi biriktirilmagan"
                description={canWrite ? "\"Tarbiyachilar\" tugmasi orqali biriktiring" : undefined}
                icon={<TeacherIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {overview.teachers.map((teacher) => (
                <li key={teacher.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[12px] font-semibold text-[var(--color-primary)]">
                    {initials(teacher.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{teacher.fullName}</p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{teacher.position}</p>
                  </div>
                  {!teacher.isActive && <Badge tone="neutral">Nofaol</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Bolalar</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {overview.children.items.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState title="Bu guruhda bola yo'q" icon={<GroupIcon className="h-[26px] w-[26px]" />} />
            </div>
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Ism</Th>
                  <Th>Jinsi</Th>
                  <Th>Tug&apos;ilgan sana</Th>
                  <Th>Holati</Th>
                </tr>
              </THead>
              <TBody>
                {overview.children.items.map((child) => (
                  <Tr key={child.id}>
                    <Td>
                      <Link href={`/${slug}/children/${child.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                        {child.fullName}
                      </Link>
                      <span className="ml-1.5 text-[12px] text-[var(--color-text-muted)]">{formatChildId(child.publicId)}</span>
                    </Td>
                    <Td className="text-[var(--color-text-muted)]">{formatGender(child.gender)}</Td>
                    <Td className="text-[var(--color-text-muted)]">
                      {child.birthDate ? `${formatDate(child.birthDate)} (${formatAge(child.birthDate)})` : "—"}
                    </Td>
                    <Td>
                      <Badge tone={CHILD_STATUS_TONE[child.status]}>{CHILD_STATUS_LABEL[child.status]}</Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <CardTitle>Davomat ({attendanceQuery.data ? `${attendanceQuery.data.from} — ${attendanceQuery.data.to}` : "so'nggi 14 kun"})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_PRESETS.map((preset) => {
              const to = todayDateString();
              const from = shiftDays(to, -(preset.days - 1));
              const active = range?.from === from && range?.to === to;
              return (
                <FilterPill key={preset.days} active={active} onClick={() => setRange({ from, to })}>
                  {preset.label}
                </FilterPill>
              );
            })}
          </div>
        </div>
        <CardBody className="p-0">
          {attendanceQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : attendanceQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(attendanceQuery.error as Error).message} />
            </div>
          ) : !attendanceQuery.data || attendanceQuery.data.children.length === 0 ? (
            <EmptyState title="Davomat ma'lumoti yo'q" />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Bola</Th>
                  <Th numeric>Keldi</Th>
                  <Th numeric>Kelmadi</Th>
                  <Th numeric>Foiz</Th>
                </tr>
              </THead>
              <TBody>
                {attendanceQuery.data.children.map((child) => (
                  <Tr key={child.childId}>
                    <Td className="font-medium">{child.fullName}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{child.present}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{child.absent}</Td>
                    <Td numeric>{child.rate === null ? "—" : <Badge tone={child.rate >= 80 ? "success" : child.rate >= 50 ? "warning" : "danger"}>{child.rate}%</Badge>}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      {canWrite && editOpen && <EditGroupModal open={editOpen} onClose={() => setEditOpen(false)} slug={slug} group={groupForModals} />}
      {canWrite && teachersOpen && (
        <ManageTeachersModal open={teachersOpen} onClose={() => setTeachersOpen(false)} slug={slug} group={groupForModals} />
      )}
    </div>
  );
}

const ROSTER_COUNT_TONE = {
  success: { text: "text-[var(--color-success)]", bg: "bg-[var(--color-success-bg)]" },
  danger: { text: "text-[var(--color-danger)]", bg: "bg-[var(--color-danger-bg)]" },
  neutral: { text: "text-[var(--color-text-muted)]", bg: "bg-[var(--color-surface-sunken)]" },
} as const;

function RosterCount({ label, value, tone }: { label: string; value: number; tone: keyof typeof ROSTER_COUNT_TONE }) {
  const style = ROSTER_COUNT_TONE[tone];
  return (
    <div className={clsx("px-5 py-3.5 sm:px-6", style.bg)}>
      <p className={clsx("text-[22px] font-semibold leading-none tabular-nums", style.text)}>{value}</p>
      <p className="mt-1.5 text-[12.5px] font-medium text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}
