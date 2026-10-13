"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Baby, ChevronLeft, ClipboardCheck, IdCard, Pencil, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { AttendanceStatus, Group, GroupAttendanceDay, GroupAttendanceRange, GroupOverview } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational, canWriteTeaching } from "@/lib/permissions";
import { formatAge, formatChildId, formatDate } from "@/lib/format";
import { IosButton } from "@/components/ios/button";
import { DayStepper, dayMonthLabel } from "@/components/ios/day-stepper";
import { SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { Group as IosGroup, ListRow, Row } from "@/components/ios/group";
import { PageCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { CapacityBar, GroupFormSheet, GroupTile, TeachersSheet } from "@/features/groups/group-sheets";
import { useTr } from "@/i18n/tr";

const TIMEZONE = "Asia/Tashkent";
const todayTashkent = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
const shiftDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const ATTENDANCE: Record<AttendanceStatus, { label: string; color: string }> = {
  PRESENT: { label: "Keldi", color: IOS.green },
  ABSENT: { label: "Kelmadi", color: IOS.red },
  LATE: { label: "Kech qoldi", color: IOS.orange },
  SICK: { label: "Kasal", color: "#af52de" },
};
const CHILD_STATUS: Record<string, { label: string; color: string }> = {
  INACTIVE: { label: "Nofaol", color: IOS.gray },
  QUARANTINED: { label: "Karantinda", color: IOS.red },
};

type RangeDays = "7" | "14" | "30";
type Tab = "day" | "children" | "stats";

/**
 * Guruh sahifasi — iOS uslubida: sarlavha (rangli plitka, holat, filial,
 * bolalar/sig'im chizig'i), tezkor amallar (davomat, tarbiyachilar,
 * tahrirlash), "Kim keldi" (kun tanlab), tarbiyachilar, bolalar va
 * davomat statistikasi (eng kam qatnashganlar tepada).
 */
export default function GroupDetailPage({ params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const tr = useTr();
  const { slug, groupId } = use(params);
  const { base } = useBranchContext(slug);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const canMark = canWriteTeaching(user?.role);
  const [editOpen, setEditOpen] = useState(false);
  const [teachersOpen, setTeachersOpen] = useState(false);
  const [today, setToday] = useState("");
  const [day, setDay] = useState("");
  const [rangeDays, setRangeDays] = useState<RangeDays>("14");
  const [childSearch, setChildSearch] = useState("");
  const [tab, setTab] = useState<Tab>("day");

  // Sana mijoz soatiga bog'liq — server va brauzer HTML'i mos kelsin
  useEffect(() => {
    const t = todayTashkent();
    setToday(t);
    setDay((d) => d || t);
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["group-overview", slug, groupId],
    queryFn: () => api.get<GroupOverview>(`/app/groups/${groupId}/overview`),
  });
  const rosterQuery = useQuery({
    queryKey: ["group-day", slug, groupId, day],
    queryFn: () => api.get<GroupAttendanceDay>(`/app/groups/${groupId}/attendance/day?date=${day}`),
    enabled: !!day,
  });
  const from = today ? shiftDays(today, -(Number(rangeDays) - 1)) : "";
  const rangeQuery = useQuery({
    queryKey: ["group-attendance-range", slug, groupId, from, today],
    queryFn: () => api.get<GroupAttendanceRange>(`/app/groups/${groupId}/attendance?from=${from}&to=${today}`),
    enabled: !!today,
  });

  const overview = overviewQuery.data;
  const children = useMemo(() => {
    const q = childSearch.trim().toLowerCase();
    return (overview?.children.items ?? []).filter((c) => !q || c.fullName.toLowerCase().includes(q) || String(c.publicId).includes(q));
  }, [overview, childSearch]);
  const ranked = useMemo(
    () => [...(rangeQuery.data?.children ?? [])].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.fullName.localeCompare(b.fullName)),
    [rangeQuery.data],
  );

  if (overviewQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState message={(overviewQuery.error as Error).message} onRetry={() => overviewQuery.refetch()} retrying={overviewQuery.isFetching} />
      </div>
    );
  }

  // Varaqlar `Group` shaklini kutadi — overview'dagi qismlardan yig'iladi
  const group: Group | null = overview
    ? { id: overview.group.id, branchId: overview.branch.id, name: overview.group.name, capacity: overview.group.capacity, status: overview.group.status, createdAt: overview.group.createdAt }
    : null;
  const active = overview?.children.active ?? 0;
  const capacity = overview?.group.capacity ?? 0;
  const attendanceHref = overview ? `${base}/attendance?group=${encodeURIComponent(overview.group.name)}${day && day !== today ? `&date=${day}` : ""}` : "#";
  const year = today ? Number(today.slice(0, 4)) : undefined;

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={() => Promise.all([overviewQuery.refetch(), rosterQuery.refetch(), rangeQuery.refetch()])} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        {/* Telefonda yuqori panelning o'z "←" tugmasi bor */}
        <Link href={`${base}/groups`} className="hidden h-9 items-center md:inline-flex gap-0.5 rounded-full pr-3 text-[15px] font-medium text-[var(--color-primary)] active:opacity-50">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
          {tr("Guruhlar")}
        </Link>

        {/* Sarlavha */}
        <PageCard className="px-4 py-4">
          {!overview ? (
            <div className="flex items-center gap-3">
              <span className="h-14 w-14 animate-pulse rounded-[16px] bg-[#767680]/[0.12]" />
              <span className="flex-1 space-y-2">
                <span className="block h-5 w-1/2 animate-pulse rounded-full bg-[#767680]/[0.12]" />
                <span className="block h-3.5 w-1/3 animate-pulse rounded-full bg-[#767680]/[0.08]" />
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <GroupTile name={overview.group.name} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 data-hero className="truncate text-[20px] font-bold leading-tight text-[var(--color-text)]">
                      {tr(overview.group.name)}
                    </h1>
                    <Pill color={overview.group.status === "ACTIVE" ? IOS.green : IOS.gray}>{overview.group.status === "ACTIVE" ? tr("Faol") : tr("Nofaol")}</Pill>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">{tr(overview.branch.name)}</p>
                </div>
                {canWrite && <IosButton label={tr("Tahrirlash")} icon={Pencil} compact onClick={() => setEditOpen(true)} />}
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                  <span className="text-[#8e8e93]">{tr("Bolalar / sig'im")}</span>
                  <span className="font-semibold tabular-nums text-[var(--color-text)]">
                    {active} / {capacity}
                    <span className="ml-1.5 font-normal text-[#8e8e93]">
                      {active > capacity ? tr("{0} ta ortiqcha", active - capacity) : tr("{0} ta bo'sh o'rin", capacity - active)}
                    </span>
                  </span>
                </div>
                <CapacityBar count={active} capacity={capacity} className="h-2" />
              </div>
            </>
          )}
        </PageCard>

        <StatStrip tone="white">
          <StatCell label={tr("Bugun keldi")} value={rosterQuery.data && day === today ? rosterQuery.data.counts.present : "—"} color={IOS.green} hint={rosterQuery.data && day === today ? tr("{0} tadan", rosterQuery.data.total) : undefined} loading={!overview} />
          <StatCell label={tr("O'g'il bolalar")} value={overview?.children.boys ?? 0} loading={!overview} />
          <StatCell label={tr("Qiz bolalar")} value={overview?.children.girls ?? 0} loading={!overview} />
          <StatCell label={tr("Tarbiyachilar")} value={overview?.teachers.length ?? 0} color={overview && overview.teachers.length === 0 ? IOS.orange : undefined} loading={!overview} />
        </StatStrip>

        {/* Tezkor amal */}
        {canMark && overview && (
          <IosGroup>
            <Row href={attendanceHref} leading={<IosIcon icon={ClipboardCheck} tint="green" size={30} />} title={tr("Davomatni belgilash")} subtitle={tr("Shu guruh bo'yicha ochiladi")} />
          </IosGroup>
        )}

        {/* Tarbiyachilar */}
        <IosGroup
          title={tr("Tarbiyachilar")}
          action={canWrite && overview && overview.teachers.length > 0 ? <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => setTeachersOpen(true)}>{tr("O'zgartirish")}</button> : undefined}
          bare={!overview || (overview.teachers.length === 0 && !canWrite)}
        >
          {!overview ? (
            <SkeletonRows rows={1} />
          ) : overview.teachers.length === 0 ? (
            canWrite ? (
              <Row
                onClick={() => setTeachersOpen(true)}
                leading={<IosIcon icon={UserPlus} tint="orange" size={30} />}
                title={<span className="font-medium text-[var(--color-primary)]">{tr("Tarbiyachi biriktirish")}</span>}
                subtitle={tr("Hali hech kim biriktirilmagan")}
              />
            ) : (
              <EmptyState icon={IdCard} title="Hali tarbiyachi biriktirilmagan" />
            )
          ) : (
            overview.teachers.map((t) => (
              <ListRow
                key={t.id}
                href={`${base}/employees/${t.id}`}
                avatar={<IosAvatar name={t.fullName} size={40} />}
                title={tr(t.fullName)}
                subtitle={tr(t.position)}
                meta={!t.isActive ? <Pill>{tr("Nofaol")}</Pill> : undefined}
              />
            ))
          )}
        </IosGroup>

        {/* Bitta ro'yxat ko'rinadi — telefonda sahifa cheksiz cho'zilmasin */}
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          label={tr("Bo'lim")}
          options={[
            { value: "day", label: tr("Kim keldi") },
            { value: "children", label: overview ? tr("Bolalar · {0}", overview.children.items.length) : tr("Bolalar") },
            { value: "stats", label: tr("Statistika") },
          ]}
        />

        {/* Kim keldi */}
        {tab === "day" && (
          <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {day && today && <DayStepper value={day} onChange={setDay} today={today} max={today} />}
          </div>
          {rosterQuery.isError ? (
            <ErrorState message={(rosterQuery.error as Error).message} onRetry={() => rosterQuery.refetch()} retrying={rosterQuery.isFetching} />
          ) : !rosterQuery.data ? (
            <SkeletonRows rows={3} />
          ) : rosterQuery.data.total === 0 ? (
            <EmptyState icon={Baby} title="Bu guruhda faol bola yo'q" />
          ) : (
            <IosGroup
              footer={
                rosterQuery.data.counts.unmarked > 0 && canMark ? (
                  <Link href={attendanceHref} className="font-medium text-[var(--color-primary)]">
                    {tr("{0} ta bola belgilanmagan — belgilash", rosterQuery.data.counts.unmarked)} ›
                  </Link>
                ) : undefined
              }
            >
              <div className="grid grid-cols-3 gap-px bg-black/[0.06]">
                {[
                  { label: tr("Keldi"), value: rosterQuery.data.counts.present, color: IOS.green },
                  { label: tr("Kelmadi"), value: rosterQuery.data.counts.absent, color: IOS.red },
                  { label: tr("Belgilanmagan"), value: rosterQuery.data.counts.unmarked, color: IOS.gray },
                ].map((c) => (
                  <div key={c.label} className="min-w-0 bg-white px-3 py-3 sm:px-4">
                    <p className="text-[22px] font-bold leading-none tabular-nums" style={{ color: c.value ? c.color : "var(--color-text)" }}>
                      {c.value}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-[#8e8e93]">{c.label}</p>
                  </div>
                ))}
              </div>
              {rosterQuery.data.items.map((item) => (
                <ListRow
                  key={item.childId}
                  href={`${base}/children/${item.childId}`}
                  avatar={<IosAvatar name={item.fullName} size={40} />}
                  title={tr(item.fullName)}
                  subtitle={[formatChildId(item.publicId), item.note].filter(Boolean).join(" · ")}
                  meta={item.status ? <Pill color={ATTENDANCE[item.status].color}>{tr(ATTENDANCE[item.status].label)}</Pill> : <Pill>{tr("Belgilanmagan")}</Pill>}
                />
              ))}
            </IosGroup>
          )}
        </section>
        )}

        {/* Bolalar */}
        {tab === "children" && (
          <section className="space-y-3">
          {overview && overview.children.items.length > 8 && <SearchPill value={childSearch} onChange={setChildSearch} placeholder={tr("Bola ismi yoki ID")} />}
          <IosGroup bare={!overview || children.length === 0}>
            {!overview ? (
              <SkeletonRows rows={4} />
            ) : children.length === 0 ? (
              <EmptyState icon={Baby} title={childSearch ? "Bola topilmadi" : "Bu guruhda bola yo'q"} />
            ) : (
              children.map((c) => (
                <ListRow
                  key={c.id}
                  href={`${base}/children/${c.id}`}
                  avatar={
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
                      style={{
                        backgroundColor: c.gender === "FEMALE" ? "#ff2d551f" : c.gender === "MALE" ? "#007aff1f" : "#8e8e931f",
                        color: c.gender === "FEMALE" ? "#ff2d55" : c.gender === "MALE" ? "#007aff" : "#8e8e93",
                      }}
                    >
                      {c.fullName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("")}
                    </span>
                  }
                  title={tr(c.fullName)}
                  subtitle={[formatChildId(c.publicId), c.birthDate ? `${formatAge(c.birthDate)} · ${formatDate(c.birthDate)}` : null].filter(Boolean).join(" · ")}
                  meta={CHILD_STATUS[c.status] ? <Pill color={CHILD_STATUS[c.status].color}>{tr(CHILD_STATUS[c.status].label)}</Pill> : undefined}
                />
              ))
            )}
          </IosGroup>
        </section>
        )}

        {/* Davomat statistikasi */}
        {tab === "stats" && (
          <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="px-4 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("Davr")}</h2>
            <div className="w-[210px]">
              <Segmented<RangeDays>
                value={rangeDays}
                onChange={setRangeDays}
                label={tr("Davr")}
                options={[
                  { value: "7", label: tr("7 kun") },
                  { value: "14", label: tr("14 kun") },
                  { value: "30", label: tr("30 kun") },
                ]}
              />
            </div>
          </div>
          {rangeQuery.isError ? (
            <ErrorState message={(rangeQuery.error as Error).message} onRetry={() => rangeQuery.refetch()} retrying={rangeQuery.isFetching} />
          ) : !rangeQuery.data ? (
            <SkeletonRows rows={3} avatar={false} />
          ) : rangeQuery.data.children.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Davomat ma'lumoti yo'q" />
          ) : (
            <>
              {/* Kunlik ustunlar: kelganlar ulushi */}
              <PageCard className="px-4 pb-3 pt-4">
                <div className="flex h-24 items-end gap-[3px]">
                  {rangeQuery.data.days.map((d) => {
                    const total = rangeQuery.data.totalChildren || 1;
                    const marked = d.present + d.absent;
                    const h = marked ? Math.max(6, (d.present / total) * 100) : 4;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setDay(d.date);
                          setTab("day");
                        }}
                        title={`${dayMonthLabel(d.date, tr, year)}: ${d.present}/${total}`}
                        className="flex h-full min-w-0 flex-1 items-end"
                      >
                        <span
                          className={clsx("block w-full rounded-[4px] transition-opacity hover:opacity-80", d.date === day ? "bg-[var(--color-primary)]" : marked ? "bg-[var(--color-primary)]/35" : "bg-[#767680]/[0.14]")}
                          style={{ height: `${h}%` }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[11.5px] tabular-nums text-[#8e8e93]">
                  <span>{dayMonthLabel(rangeQuery.data.from, tr, year)}</span>
                  <span>{dayMonthLabel(rangeQuery.data.to, tr, year)}</span>
                </div>
              </PageCard>
              <IosGroup title={tr("Bolalar bo'yicha")} footer={tr("Eng kam qatnashganlar tepada.")}>
                {ranked.map((c) => (
                  <ListRow
                    key={c.childId}
                    href={`${base}/children/${c.childId}`}
                    avatar={<IosAvatar name={c.fullName} size={40} />}
                    title={tr(c.fullName)}
                    subtitle={tr("keldi {0} · kelmadi {1}", c.present, c.absent)}
                    meta={
                      c.rate === null ? (
                        <Pill>—</Pill>
                      ) : (
                        <Pill color={c.rate >= 80 ? IOS.green : c.rate >= 50 ? IOS.orange : IOS.red}>{c.rate}%</Pill>
                      )
                    }
                  />
                ))}
              </IosGroup>
            </>
          )}
        </section>
        )}
      </div>

      {canWrite && <GroupFormSheet open={editOpen} onClose={() => setEditOpen(false)} slug={slug} group={group} />}
      {canWrite && <TeachersSheet open={teachersOpen} onClose={() => setTeachersOpen(false)} slug={slug} group={group} />}
    </div>
  );
}
