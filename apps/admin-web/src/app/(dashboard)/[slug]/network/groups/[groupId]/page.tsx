"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { GroupAttendanceDay, GroupAttendanceRange, GroupOverview } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { CapacityRing } from "@/features/network/capacity-ring";
import { monogram, paletteFor } from "@/features/network/palette";
import { formatChildId } from "@/lib/format";
import { ArrowLeftIcon, CheckIcon, CloseIcon, ClockIcon, TeacherIcon } from "@/components/ui/icons";

const DEFAULT_TIMEZONE = "Asia/Tashkent";
/** Uzbekcha qisqa kun nomlari — Intl uz-UZ da bular chiroyli chiqmaydi. */
const WEEKDAY = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
const MONTH = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const PRESETS = [
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

/** "2026-09-09" -> { weekday: "Se", label: "9 sen" } */
function describeDay(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return {
    weekday: WEEKDAY[d.getUTCDay()],
    label: `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`,
    isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
  };
}

export default function NetworkGroupDetailPage({
  params,
}: {
  params: Promise<{ slug: string; groupId: string }>;
}) {
  const { slug, groupId } = use(params);
  // Sana mijoz soatiga bog'liq — birinchi renderda emas, effektda hisoblanadi,
  // aks holda server va brauzer HTML'i mos kelmaydi.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  // Nomli ro'yxat uchun tanlangan kun — sukut bo'yicha bugun
  const [rosterDate, setRosterDate] = useState<string | null>(null);

  useEffect(() => {
    const today = todayDateString();
    setRange((current) => current ?? { from: shiftDays(today, -13), to: today });
    setRosterDate((current) => current ?? today);
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["group-overview", groupId],
    queryFn: () => api.get<GroupOverview>(`/app/groups/${groupId}/overview`),
  });

  const rosterQuery = useQuery({
    queryKey: ["group-day", groupId, rosterDate],
    queryFn: () => api.get<GroupAttendanceDay>(`/app/groups/${groupId}/attendance/day?date=${rosterDate}`),
    enabled: !!rosterDate,
  });

  const attendanceQuery = useQuery({
    queryKey: ["group-attendance", groupId, range?.from, range?.to],
    queryFn: () =>
      api.get<GroupAttendanceRange>(`/app/groups/${groupId}/attendance?from=${range!.from}&to=${range!.to}`),
    enabled: !!range,
  });

  const overview = overviewQuery.data;
  const palette = paletteFor(groupId);

  const summary = useMemo(() => {
    const days = attendanceQuery.data?.days ?? [];
    const marked = days.filter((d) => d.present + d.absent > 0);
    if (marked.length === 0) return null;
    const present = marked.reduce((sum, d) => sum + d.present, 0);
    const absent = marked.reduce((sum, d) => sum + d.absent, 0);
    return {
      markedDays: marked.length,
      avgPresent: Math.round(present / marked.length),
      rate: Math.round((present / (present + absent)) * 100),
      best: marked.reduce((top, d) => (d.present > top.present ? d : top), marked[0]),
    };
  }, [attendanceQuery.data]);

  if (overviewQuery.isLoading) return <LoadingState />;
  if (overviewQuery.isError) return <ErrorState message={(overviewQuery.error as Error).message} />;
  if (!overview) return <EmptyState title="Guruh topilmadi" />;

  const { group, branch, teachers, children } = overview;
  const attendanceByChild = new Map(attendanceQuery.data?.children.map((c) => [c.childId, c]) ?? []);

  return (
    <div className="space-y-5">
      <Link
        href={`/${slug}/network/groups`}
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        Guruhlar
      </Link>

      {/* Sarlavha: guruh, filial, tarbiyachilar va to'lganlik */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <CapacityRing value={children.active} total={group.capacity} ringClass={palette.ring} size={84} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("flex h-7 w-7 items-center justify-center rounded-[9px] text-[11px] font-bold", palette.chip)}>
              {monogram(group.name)}
            </span>
            <h1 className="text-xl font-semibold text-[var(--color-text)]">{group.name}</h1>
            <Badge tone={group.status === "ACTIVE" ? "success" : "neutral"}>
              {group.status === "ACTIVE" ? "Faol" : "Nofaol"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{branch.name}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {teachers.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warning-bg)] px-3 py-1 text-xs font-medium text-[var(--color-warning)]">
                Tarbiyachi biriktirilmagan
              </span>
            ) : (
              teachers.map((teacher) => (
                <span
                  key={teacher.id}
                  className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", palette.chip)}
                >
                  <TeacherIcon className="h-3.5 w-3.5" />
                  {teacher.fullName}
                  <span className="opacity-70">· {teacher.position}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Faol bolalar" value={children.active} hint={children.total > children.active ? `${children.total} ta ro'yxatda` : undefined} tone="brand" />
        <StatTile label="O'g'il bolalar" value={children.boys} hint={percentHint(children.boys, children.active)} tone="sky" />
        <StatTile label="Qiz bolalar" value={children.girls} hint={percentHint(children.girls, children.active)} tone="rose" />
        <StatTile label="Bo'sh o'rin" value={Math.max(0, group.capacity - children.active)} hint={`Sig'im ${group.capacity}`} tone="neutral" />
      </div>

      {/* Kunlik nomli ro'yxat: aynan kim keldi, kim kelmadi */}
      <Card className="overflow-hidden">
        <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
              Kim keldi
            </h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Tanlangan kun uchun ismma-ism ro&apos;yxat</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rosterDate &&
              [
                { label: "Bugun", value: todayDateString() },
                { label: "Kecha", value: shiftDays(todayDateString(), -1) },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRosterDate(option.value)}
                  className={clsx(
                    "cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                    rosterDate === option.value
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            <DateField
              label="sana"
              value={rosterDate ?? ""}
              max={todayDateString()}
              onChange={(value) => setRosterDate(value)}
            />
          </div>
        </div>

        {!rosterDate || rosterQuery.isLoading ? (
          <div className="px-5 py-5 sm:px-6">
            <LoadingState rows={2} />
          </div>
        ) : rosterQuery.isError ? (
          <div className="px-5 py-5 sm:px-6">
            <ErrorState message={(rosterQuery.error as Error).message} />
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="grid grid-cols-3 gap-3">
              <RosterCount label="Keldi" value={rosterQuery.data!.counts.present} tone="success" />
              <RosterCount label="Kelmadi" value={rosterQuery.data!.counts.absent} tone="danger" />
              <RosterCount label="Belgilanmagan" value={rosterQuery.data!.counts.unmarked} tone="neutral" />
            </div>

            {rosterQuery.data!.total === 0 ? (
              <EmptyState title="Bu guruhda faol bola yo'q" />
            ) : (
              <div className="space-y-3.5">
                <RosterList
                  title="Keldi"
                  tone="success"
                  icon={<CheckIcon className="h-3.5 w-3.5" />}
                  names={rosterQuery.data!.items.filter((i) => i.status === "PRESENT")}
                />
                <RosterList
                  title="Kelmadi"
                  tone="danger"
                  icon={<CloseIcon className="h-3.5 w-3.5" />}
                  names={rosterQuery.data!.items.filter((i) => i.status === "ABSENT")}
                />
                <RosterList
                  title="Belgilanmagan"
                  tone="neutral"
                  icon={<ClockIcon className="h-3.5 w-3.5" />}
                  names={rosterQuery.data!.items.filter((i) => i.status === null)}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Davomat: sana oralig'i bo'yicha kunlik yig'indi */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Kunlik davomat</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Qaysi kuni nechta bola kelgani</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => {
              const to = todayDateString();
              const from = shiftDays(to, -(preset.days - 1));
              const active = range?.from === from && range?.to === to;
              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => setRange({ from, to })}
                  className={clsx(
                    "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
            <DateField
              label="dan"
              value={range?.from ?? ""}
              max={range?.to}
              onChange={(from) => setRange((r) => (r ? { ...r, from } : r))}
            />
            <DateField
              label="gacha"
              value={range?.to ?? ""}
              min={range?.from}
              onChange={(to) => setRange((r) => (r ? { ...r, to } : r))}
            />
          </div>
        </div>

        {!range || attendanceQuery.isLoading ? (
          <div className="px-5 py-6">
            <LoadingState />
          </div>
        ) : attendanceQuery.isError ? (
          <div className="px-5 py-6">
            <ErrorState message={(attendanceQuery.error as Error).message} />
          </div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-3 divide-x divide-[var(--color-separator)] border-b border-[var(--color-separator)]">
                <MiniStat label="O'rtacha kelgan" value={`${summary.avgPresent} bola`} />
                <MiniStat label="Davomat foizi" value={`${summary.rate}%`} />
                <MiniStat label="Belgilangan kunlar" value={`${summary.markedDays} kun`} />
              </div>
            )}
            <ul className="divide-y divide-[var(--color-separator)]">
              {attendanceQuery.data!.days.map((day) => {
                const info = describeDay(day.date);
                const marked = day.present + day.absent > 0;
                const total = attendanceQuery.data!.totalChildren;
                const share = total > 0 ? (day.present / total) * 100 : 0;
                return (
                  <li key={day.date} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="w-[86px] shrink-0">
                      <p className={clsx("text-[13px] font-medium", info.isWeekend ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]")}>
                        {info.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{info.weekday}</p>
                    </div>
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                      {marked && <div className={clsx("h-full rounded-full", palette.dot)} style={{ width: `${share}%` }} />}
                    </div>
                    <div className="w-[150px] shrink-0 text-right text-[13px]">
                      {marked ? (
                        <span className="text-[var(--color-text)]">
                          <b>{day.present}</b> keldi
                          {day.absent > 0 && <span className="text-[var(--color-text-muted)]"> · {day.absent} kelmadi</span>}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">Belgilanmagan</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {/* Guruhdagi bolalar va ularning shu oraliqdagi davomati */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--color-separator)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">O&apos;quvchilar</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {children.total} bola{range ? ` · davomat ${range.from} — ${range.to}` : ""}
          </p>
        </div>
        {children.items.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState title="Bu guruhda hali bola yo'q" />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-separator)]">
            {children.items.map((child) => {
              const stats = attendanceByChild.get(child.id);
              return (
                <li key={child.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      child.gender === "MALE"
                        ? "bg-sky-50 text-sky-700"
                        : child.gender === "FEMALE"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                    )}
                  >
                    {monogram(child.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${slug}/children/${child.id}`}
                      className="truncate text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                    >
                      {child.fullName}
                    </Link>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {formatChildId(child.publicId)}
                      {child.status !== "ACTIVE" && " · Nofaol"}
                    </p>
                  </div>
                  {stats && (
                    <div className="shrink-0 text-right text-[13px]">
                      {stats.rate === null ? (
                        <span className="text-[var(--color-text-muted)]">Belgilanmagan</span>
                      ) : (
                        <>
                          <span
                            className={clsx(
                              "font-semibold",
                              stats.rate >= 85
                                ? "text-[var(--color-success)]"
                                : stats.rate >= 60
                                  ? "text-[var(--color-warning)]"
                                  : "text-[var(--color-danger)]",
                            )}
                          >
                            {stats.rate}%
                          </span>
                          <span className="text-[var(--color-text-muted)]"> · {stats.present}/{stats.present + stats.absent}</span>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

const ROSTER_TONE = {
  success: {
    count: "text-[var(--color-success)]",
    well: "bg-[var(--color-success-bg)]",
    chip: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  },
  danger: {
    count: "text-[var(--color-danger)]",
    well: "bg-[var(--color-danger-bg)]",
    chip: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  },
  neutral: {
    count: "text-[var(--color-text-muted)]",
    well: "bg-[var(--color-surface-sunken)]",
    chip: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
  },
} as const;

function RosterCount({ label, value, tone }: { label: string; value: number; tone: keyof typeof ROSTER_TONE }) {
  const style = ROSTER_TONE[tone];
  return (
    <div className={clsx("rounded-[var(--radius-md)] px-4 py-3", style.well)}>
      <p className={clsx("text-[26px] font-bold leading-none tabular-nums", style.count)}>{value}</p>
      <p className="mt-1 text-[12.5px] font-medium text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

/** Ismlar chip sifatida — jadval qatoridan ko'ra tezroq o'qiladi. */
function RosterList({
  title,
  tone,
  icon,
  names,
}: {
  title: string;
  tone: keyof typeof ROSTER_TONE;
  icon: React.ReactNode;
  names: { childId: string; fullName: string }[];
}) {
  if (names.length === 0) return null;
  const style = ROSTER_TONE[tone];
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        <span className={clsx("flex h-5 w-5 items-center justify-center rounded-full", style.chip)}>{icon}</span>
        {title} · {names.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {names.map((child) => (
          <span
            key={child.childId}
            className={clsx("rounded-full px-3 py-1.5 text-[13px] font-medium", style.chip)}
          >
            {child.fullName}
          </span>
        ))}
      </div>
    </div>
  );
}

function percentHint(value: number, total: number): string | undefined {
  if (total === 0) return undefined;
  return `${Math.round((value / total) * 100)}% — ${total} tadan`;
}

const TILE_TONE = {
  brand: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  sky: "bg-sky-50 text-sky-700",
  rose: "bg-rose-50 text-rose-600",
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
} as const;

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: keyof typeof TILE_TONE;
}) {
  return (
    <Card className="p-4">
      <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", TILE_TONE[tone])}>{label}</span>
      <p className="mt-2 text-3xl font-bold leading-none text-[var(--color-text)]">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
      />
    </label>
  );
}
