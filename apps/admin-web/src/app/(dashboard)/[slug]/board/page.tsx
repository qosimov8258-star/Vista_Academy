"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Baby, ChartColumn, DoorOpen, IdCard, RefreshCw, UserX, Utensils } from "lucide-react";
import { api } from "@/lib/api";
import { IosButton } from "@/components/ios/button";
import { DayStepper } from "@/components/ios/day-stepper";
import { Group, ListRow, Row } from "@/components/ios/group";
import { KpiCard } from "@/components/ios/kpi-card";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { todayTashkent, type BoardGroup, type BoardResult } from "@/features/desk/shared";
import { useTr } from "@/i18n/tr";

const STAFF_STATUS = {
  ABSENT: { label: "Kelmadi", color: IOS.red },
  SICK: { label: "Kasal", color: IOS.orange },
  ON_LEAVE: { label: "Ta'til", color: IOS.blue },
} as const;

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/**
 * Bugungi holat — iOS uslubida (CLAUDE.md). Funksiyalar avvalgidek: sana
 * tanlash (sukut — bugun), har daqiqada o'zi yangilanadi; kelgan bolalar,
 * kelmagan/kasal, hozir bog'chada va olib ketilganlar, ovqat porsiyasi;
 * guruhlar bo'yicha (keldi, kelmadi, kasal, belgilanmagan, olib ketildi);
 * kelmagan xodimlar. Qo'shimcha: guruh qatori bosilsa tafsilot varag'i,
 * yangilash tugmasi va pastga tortish.
 */
export default function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  // Toshkent sanasi faqat brauzerda hisoblanadi (server bilan farq qilmasin)
  useEffect(() => {
    const t = todayTashkent();
    setToday(t);
    setDate((d) => d || t);
  }, []);
  const [openGroup, setOpenGroup] = useState<BoardGroup | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: ["desk-board", slug, date],
    queryFn: () => api.get<BoardResult>(`/app/desk/board?date=${date}`),
    enabled: !!date,
    refetchInterval: 60_000,
  });
  const board = query.data;
  const t = board?.totals;
  const loading = !date || query.isLoading;

  const refresh = () => query.refetch();
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const groupPill = (g: BoardGroup) => {
    if (g.total === 0) return undefined;
    if (g.notMarked === g.total) return <Pill color={IOS.gray}>—/{g.total}</Pill>;
    const color = g.present === g.total ? IOS.green : g.absent + g.sick > 0 ? IOS.orange : IOS.green;
    return (
      <Pill color={color} title={tr("{0} tasi keldi", g.present)}>
        {g.present}/{g.total}
      </Pill>
    );
  };
  const groupSubtitle = (g: BoardGroup) =>
    [
      `${tr("Kelmadi")} ${g.absent}`,
      `${tr("Kasal")} ${g.sick}`,
      g.notMarked > 0 ? `${tr("Belgilanmagan")} ${g.notMarked}` : null,
      `${tr("Olib ketildi")} ${g.pickedUp}`,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <PageHeaderCard
          icon={ChartColumn}
          tint="teal"
          title={tr("Bugungi holat")}
          count={t ? tr("{0} / {1} keldi", t.present, t.total) : undefined}
          subtitle={tr("Bog'cha hozir qanday: kim keldi, kim ketdi")}
          actions={<IosButton label={tr("Yangilash")} icon={RefreshCw} compact onClick={onRefresh} loading={refreshing} />}
        />

        {date && today && <DayStepper value={date} onChange={setDate} today={today} />}

        {query.isError && !board ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : (
          <>
            {/* Ko'rsatkichlar — kompyuterda 4 ta, telefonda 2×2 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                icon={Baby}
                tint="green"
                label={tr("Kelgan bolalar")}
                value={loading || !t ? null : t.present}
                pill={t && t.total > 0 ? <Pill color={IOS.green}>{pct(t.present, t.total)}%</Pill> : undefined}
                hint={t ? (t.notMarked > 0 ? tr("{0} tadan · {1} tasi belgilanmagan", t.total, t.notMarked) : tr("{0} tadan", t.total)) : undefined}
                progress={t ? pct(t.present, t.total) : undefined}
                progressColor={IOS.green}
              />
              <KpiCard
                icon={UserX}
                tint="red"
                label={tr("Kelmagan / kasal")}
                value={loading || !t ? null : `${t.absent} / ${t.sick}`}
                hint={t ? tr("kelmadi / kasal") : undefined}
              />
              <KpiCard
                icon={DoorOpen}
                tint="blue"
                label={tr("Hozir bog'chada")}
                value={loading || !board ? null : board.stillHere}
                hint={t ? tr("{0} tasi olib ketilgan", t.pickedUp) : undefined}
              />
              <KpiCard
                icon={Utensils}
                tint="orange"
                label={tr("Ovqat tayyorlanadi")}
                value={loading || !board ? null : board.mealCount}
                hint={tr("kelgan + kechikkanlar")}
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
              {/* Guruhlar bo'yicha */}
              <Group
                title={
                  <>
                    {tr("Guruhlar bo'yicha")}
                    {board && <span className="tabular-nums">· {board.groups.length}</span>}
                  </>
                }
                refreshing={query.isFetching && !query.isLoading && !refreshing}
                bare={loading || !board || board.groups.length === 0}
              >
                {loading ? (
                  <SkeletonRows rows={5} />
                ) : !board || board.groups.length === 0 ? (
                  <EmptyState icon={ChartColumn} title="Guruh yo'q" />
                ) : (
                  board.groups.map((g) => (
                    <ListRow
                      key={g.groupId ?? "none"}
                      onClick={() => setOpenGroup(g)}
                      avatar={<IosAvatar name={tr(g.name)} letters={1} />}
                      title={tr(g.name)}
                      subtitle={groupSubtitle(g)}
                      meta={groupPill(g)}
                    />
                  ))
                )}
              </Group>

              {/* Kelmagan xodimlar */}
              <Group
                title={
                  <>
                    {tr("Kelmagan xodimlar")}
                    {board && <span className="tabular-nums">· {board.staffAway.length}</span>}
                  </>
                }
                bare={loading}
              >
                {loading ? (
                  <SkeletonRows rows={2} />
                ) : !board || board.staffAway.length === 0 ? (
                  <Row leading={<IosIcon icon={IdCard} tint="green" size={30} />} title={tr("Hamma xodim ishda")} />
                ) : (
                  board.staffAway.map((s, i) => (
                    <ListRow
                      key={`${s.fullName}-${i}`}
                      avatar={<IosAvatar name={s.fullName} size={44} />}
                      title={tr(s.fullName)}
                      subtitle={tr(s.position)}
                      meta={<Pill color={STAFF_STATUS[s.status].color}>{tr(STAFF_STATUS[s.status].label)}</Pill>}
                    />
                  ))
                )}
              </Group>
            </div>
          </>
        )}
      </div>

      {/* Guruh tafsiloti */}
      <IosSheet
        open={openGroup !== null}
        onClose={() => setOpenGroup(null)}
        cancelLabel="Yopish"
        title={openGroup ? tr(openGroup.name) : ""}
        footer={openGroup?.groupId ? <SheetPrimaryButton href={`/${slug}/groups/${openGroup.groupId}`}>{tr("Guruhni ochish")}</SheetPrimaryButton> : undefined}
      >
        {openGroup && (
          <>
            <StatStrip tone="white">
              <StatCell label={tr("Keldi")} value={openGroup.present} hint={tr("{0} tadan", openGroup.total)} color={IOS.green} />
              <StatCell label={tr("Kelmadi")} value={openGroup.absent} color={IOS.red} />
              <StatCell label={tr("Kasal")} value={openGroup.sick} color={IOS.orange} />
              <StatCell label={tr("Belgilanmagan")} value={openGroup.notMarked} color={IOS.gray} />
            </StatStrip>
            <SheetSection title={tr("Bugun")}>
              <SheetRow label={tr("Bolalar")}>{tr("{0} ta bola", openGroup.total)}</SheetRow>
              <SheetRow label={tr("Olib ketildi")}>{openGroup.pickedUp}</SheetRow>
            </SheetSection>
            <div className={`${GROUP_BLOCK} px-4 py-3`}>
              <div className="flex items-center justify-between text-[13px] text-[#8e8e93]">
                <span>{tr("Davomat")}</span>
                <span className="tabular-nums">{pct(openGroup.present, openGroup.total)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
                <div className="h-full rounded-full bg-[#34c759]" style={{ width: `${pct(openGroup.present, openGroup.total)}%` }} />
              </div>
            </div>
          </>
        )}
      </IosSheet>
    </div>
  );
}
