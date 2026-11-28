"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Clock, Eye, HeartHandshake, MessageSquareText, UserRoundCheck, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { ChevronRightIcon, DownloadIcon } from "@/components/ios/icons";
import { ChipRow, IosChip, SearchPill } from "@/components/ios/filters";
import { Group as IosGroup } from "@/components/ios/group";
import { IosButton } from "@/components/ios/button";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, PAGE_CARD, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IOS_TINT, IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";
import {
  BarChart,
  LEVEL_META,
  LevelDot,
  Meter,
  PAGE_META,
  RELATION_LABEL,
  dayMonth,
  formatAgo,
  formatDuration,
  weekdayShort,
} from "./engagement-ui";
import type { EngagementGuardian, EngagementLevel, EngagementOverview } from "./types";

type LevelFilter = "" | EngagementLevel;
type SortKey = "recent" | "time" | "name";

const LEVELS: EngagementLevel[] = ["ACTIVE", "LOW", "INACTIVE", "UNCONNECTED"];
const PAGE_SIZE = 50;

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/**
 * «Ota-onalar» bo'limi — ota-onalar kabinetdan qanchalik foydalanayotgani.
 *
 * Tepada umumiy ko'rsatkichlar (kabinet ochilgani, bugun/hafta kirganlar,
 * o'rtacha vaqt), 14 kunlik faollik grafigi, faollik darajalari va eng ko'p
 * ko'rilgan bo'limlar; pastda qidiruv va daraja bo'yicha saralanadigan
 * ro'yxat. Qator bosilsa — o'sha ota-onaning batafsil sahifasi.
 */
export function ParentsPage({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const { branchId: forcedBranchId, base, branches } = useBranchContext(slug);
  const canPickBranch = !!user && !user.branchId && !forcedBranchId;
  const [pickedBranch, setPickedBranch] = useState("");
  const branchId = forcedBranchId ?? (canPickBranch ? pickedBranch : "");

  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<LevelFilter>("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const query = useQuery({
    queryKey: ["parent-engagement", slug, branchId],
    queryFn: () => api.get<EngagementOverview>(`/app/parent-engagement${branchId ? `?branchId=${branchId}` : ""}`),
    refetchInterval: 60_000,
  });
  const data = query.data;
  const s = data?.summary;

  const list = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const filtered = data.guardians.filter((g) => {
      if (level && g.level !== level) return false;
      if (!q) return true;
      return (
        g.fullName.toLowerCase().includes(q) ||
        (digits.length >= 3 && g.phone.replace(/\D/g, "").includes(digits)) ||
        g.children.some((c) => c.fullName.toLowerCase().includes(q))
      );
    });
    const time = (g: EngagementGuardian) => (g.lastActivityAt ? new Date(g.lastActivityAt).getTime() : 0);
    return filtered.sort((a, b) =>
      sort === "name"
        ? a.fullName.localeCompare(b.fullName)
        : sort === "time"
          ? b.secondsWeek - a.secondsWeek || time(b) - time(a)
          : time(b) - time(a) || a.fullName.localeCompare(b.fullName),
    );
  }, [data, search, level, sort]);

  const loading = query.isLoading;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportExcel = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
      await downloadCsv(`/app/parent-engagement/report${branchId ? `?branchId=${branchId}` : ""}`, `ota-onalar-faolligi-${today}.xlsx`);
    } catch {
      setExportError(tr("Hisobotni yuklab bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <PageHeaderCard
        icon={HeartHandshake}
        tint="purple"
        title={tr("Ota-onalar")}
        count={s ? s.total : undefined}
        subtitle={tr("Kabinetdan qanchalik foydalanishyapti")}
        actions={<IosButton label={tr("Yuklab olish")} icon={DownloadIcon} compact onClick={exportExcel} loading={exporting} disabled={!data} />}
      />
      {exportError && (
        <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] text-[#d70015]">
          {exportError}
        </p>
      )}

      {canPickBranch && branches.length > 1 && (
        <ChipRow label={tr("Filial")}>
          <IosChip active={!pickedBranch} onClick={() => setPickedBranch("")}>
            {tr("Barcha filiallar")}
          </IosChip>
          {branches.map((b) => (
            <IosChip key={b.id} active={pickedBranch === b.id} onClick={() => setPickedBranch(b.id)}>
              {tr(b.name)}
            </IosChip>
          ))}
        </ChipRow>
      )}

      {query.isError && !data ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : (
        <>
          {/* Asosiy ko'rsatkichlar */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
            <Kpi
              icon={UserRoundCheck}
              tint="green"
              label={tr("Kabinet ochilgan")}
              value={s ? `${s.connected}` : null}
              suffix={s ? `/ ${s.total}` : undefined}
              hint={s ? tr("{0}% ota-ona tizimga ulangan", pct(s.connected, s.total)) : ""}
              progress={s ? pct(s.connected, s.total) : undefined}
              progressColor={IOS.green}
            />
            <Kpi
              icon={UsersRound}
              tint="blue"
              label={tr("Bu hafta kirgan")}
              value={s ? `${s.active7}` : null}
              hint={s ? tr("ulanganlarning {0}%", pct(s.active7, s.connected)) : ""}
              progress={s ? pct(s.active7, s.connected) : undefined}
              progressColor={IOS.blue}
            />
            <Kpi
              icon={Eye}
              tint="orange"
              label={tr("Bugun kirgan")}
              value={s ? `${s.activeToday}` : null}
              hint={s ? tr("jami {0}", formatDuration(s.secondsToday, tr)) : ""}
            />
            <Kpi
              icon={Clock}
              tint="purple"
              label={tr("O'rtacha vaqt")}
              value={s ? formatDuration(s.avgSecondsPerActiveWeek, tr) : null}
              hint={tr("haftasiga, bitta faol ota-ona")}
            />
          </div>

          {/* Kunlik faollik */}
          <IosGroup title={tr("Kunlik faollik · 14 kun")}>
            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <Figure label={tr("7 kunda")} value={s ? formatDuration(s.secondsWeek, tr) : "—"} />
                <Figure label={tr("30 kunda")} value={s ? formatDuration(s.secondsMonth, tr) : "—"} />
                <Figure label={tr("30 kunda kirgan")} value={s ? tr("{0} ota-ona", s.active30) : "—"} />
              </div>
              {data ? (
                <BarChart
                  values={data.daily.map((d) => d.guardians)}
                  labels={data.daily.map((d, i) => (i % 2 === data.daily.length % 2 ? dayMonth(d.date) : weekdayShort(d.date, tr)))}
                  titles={data.daily.map((d) => `${dayMonth(d.date)}: ${tr("{0} ota-ona", d.guardians)} · ${formatDuration(d.seconds, tr)}`)}
                  empty={tr("Hali hech kim kabinetga kirmagan")}
                />
              ) : (
                <div className="h-[160px] animate-pulse rounded-[12px] bg-[#767680]/[0.08]" />
              )}
              <p className="mt-3 text-[12.5px] text-[#8e8e93]">{tr("Ustun — o'sha kuni kabinetga kirgan ota-onalar soni.")}</p>
            </div>
          </IosGroup>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            {/* Faollik darajalari */}
            <IosGroup title={tr("Faollik darajasi")}>
              {s ? (
                <>
                  <div className="px-4 pb-1 pt-4">
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#767680]/[0.12]">
                      {LEVELS.map((l) =>
                        s.levels[l] ? (
                          <span key={l} style={{ width: `${pct(s.levels[l], s.total)}%`, backgroundColor: LEVEL_META[l].color }} />
                        ) : null,
                      )}
                    </div>
                  </div>
                  {LEVELS.map((l) => (
                    <StatRow
                      key={l}
                      onClick={() => setLevel(level === l ? "" : l)}
                      active={level === l}
                      leading={<span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_META[l].color }} />}
                      title={tr(LEVEL_META[l].label)}
                      subtitle={tr(LEVEL_META[l].hint)}
                      value={s.levels[l]}
                      extra={`${pct(s.levels[l], s.total)}%`}
                    />
                  ))}
                  <StatRow
                    leading={<IosIcon icon={BellRing} tint="red" size={30} />}
                    title={tr("Bildirishnoma yoqilgan")}
                    subtitle={tr("telefoniga push xabar boradi")}
                    value={s.pushEnabled}
                    extra={`${pct(s.pushEnabled, s.total)}%`}
                    tile
                  />
                  <StatRow
                    leading={<IosIcon icon={Eye} tint="orange" size={30} />}
                    title={tr("Bolasini kuzatadi")}
                    subtitle={tr("30 kunda bolaning kuni yoki kundaligini ochgan")}
                    value={s.followingChild30}
                    extra={`${pct(s.followingChild30, s.total)}%`}
                    tile
                  />
                  <StatRow
                    leading={<IosIcon icon={MessageSquareText} tint="indigo" size={30} />}
                    title={tr("Xabarlarni o'qiydi")}
                    subtitle={tr("30 kunda {0} ta xabardan {1} tasi o'qilgan", s.messagesReceived30, s.messagesRead30)}
                    value={`${pct(s.messagesRead30, s.messagesReceived30)}%`}
                    tile
                  />
                </>
              ) : (
                <SkeletonRows rows={5} />
              )}
            </IosGroup>

            {/* Nimalarni ko'rishadi */}
            <IosGroup title={tr("Nimalarni ko'rishadi · 30 kun")}>
              {!data ? (
                <SkeletonRows rows={5} />
              ) : data.pages.length === 0 ? (
                <div className="px-4 py-8 text-center text-[14px] text-[#8e8e93]">{tr("Kabinetda hali hech narsa ko'rilmagan")}</div>
              ) : (
                (() => {
                  const maxSec = Math.max(...data.pages.map((p) => p.seconds), 1);
                  return data.pages.map((p) => {
                    const meta = PAGE_META[p.page];
                    return (
                      <div key={p.page} className="group/row relative flex min-h-[60px] items-center gap-3 px-4 py-2.5">
                        <IosIcon icon={meta?.icon ?? Eye} tint={meta?.tint ?? "gray"} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[15px] text-[var(--color-text)]">{tr(meta?.label ?? p.page)}</span>
                            <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--color-text)]">{formatDuration(p.seconds, tr)}</span>
                          </div>
                          <p className="mb-1.5 truncate text-[12.5px] text-[#8e8e93]">
                            {tr("{0} ota-ona · {1} marta", p.guardians, p.views)}
                          </p>
                          <Meter value={(p.seconds / maxSec) * 100} color={IOS_TINT[meta?.tint ?? "gray"]} />
                        </div>
                        <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
                      </div>
                    );
                  });
                })()
              )}
            </IosGroup>
          </div>

          {/* Ro'yxat */}
          <div className="space-y-3">
            <SearchPill value={search} onChange={setSearch} placeholder={tr("Ota-ona, telefon yoki bola ismi")} />
            <ChipRow label={tr("Faollik darajasi")}>
              <IosChip active={level === ""} onClick={() => setLevel("")} count={s?.total}>
                {tr("Hammasi")}
              </IosChip>
              {LEVELS.map((l) => (
                <IosChip key={l} active={level === l} onClick={() => setLevel(l)} count={s?.levels[l]}>
                  {tr(LEVEL_META[l].label)}
                </IosChip>
              ))}
            </ChipRow>
            <div className="flex rounded-full bg-[#767680]/[0.12] p-[3px] sm:max-w-[420px]" role="radiogroup" aria-label={tr("Saralash")}>
              {(
                [
                  ["recent", "Oxirgi kirgan"],
                  ["time", "Ko'p vaqt"],
                  ["name", "Ism bo'yicha"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={sort === key}
                  onClick={() => setSort(key)}
                  className={clsx(
                    "h-8 min-w-0 flex-1 truncate rounded-full px-2 text-[13px] font-medium transition-colors",
                    sort === key ? "bg-white text-[var(--color-text)] shadow-sm" : "text-[#8e8e93]",
                  )}
                >
                  {tr(label)}
                </button>
              ))}
            </div>
          </div>

          <IosGroup
            title={
              <>
                {tr("Ro'yxat")}
                {data && <span className="font-normal normal-case tracking-normal">· {list.length}</span>}
              </>
            }
            refreshing={query.isFetching && !loading}
            bare
          >
            {loading ? (
              <SkeletonRows rows={7} />
            ) : list.length === 0 ? (
              <EmptyState
                icon={HeartHandshake}
                title={search || level ? "Ota-ona topilmadi" : "Hali ota-ona yo'q"}
                hint={search || level ? "Qidiruv yoki filtrni o'zgartiring" : "Bolaga ota-ona biriktirilganda shu yerda ko'rinadi"}
              />
            ) : (
              <>
                <div className="ios-snow">
                  <div className={GROUP_BLOCK}>
                    {list.slice(0, limit).map((g) => (
                      <GuardianRow key={g.id} g={g} href={`${base}/parents/${g.id}`} showBranch={canPickBranch && !pickedBranch} />
                    ))}
                  </div>
                </div>
                {list.length > limit && (
                  <div className="flex justify-center pt-3">
                    <IosButton label={tr("Yana ko'rsatish")} onClick={() => setLimit((n) => n + PAGE_SIZE)} />
                  </div>
                )}
              </>
            )}
          </IosGroup>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  tint,
  label,
  value,
  suffix,
  hint,
  progress,
  progressColor,
}: {
  icon: AnyIcon;
  tint: IosTint;
  label: string;
  value: string | null;
  suffix?: string;
  hint: string;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <div className={clsx(PAGE_CARD, "flex min-w-0 flex-col p-4")}>
      <div className="flex items-center gap-2.5">
        <IosIcon icon={icon} tint={tint} size={30} />
        <span className="line-clamp-2 min-w-0 flex-1 text-[14px] font-medium leading-tight text-[#6d6d72]">{label}</span>
      </div>
      <p className="mt-3 flex min-w-0 items-baseline gap-1.5 truncate text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]">
        {value === null ? <span className="inline-block h-7 w-16 animate-pulse rounded-lg bg-[#767680]/[0.12] align-middle" /> : value}
        {suffix && value !== null && <span className="text-[17px] font-semibold text-[#8e8e93]">{suffix}</span>}
      </p>
      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-[#8e8e93]">{hint}</p>
      {progress !== undefined && (
        <div className="mt-2">
          <Meter value={progress} color={progressColor ?? IOS.green} />
        </div>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[13px] text-[#8e8e93]">
      {label}: <span className="font-semibold tabular-nums text-[var(--color-text)]">{value}</span>
    </span>
  );
}

function StatRow({
  leading,
  title,
  subtitle,
  value,
  extra,
  onClick,
  active,
  tile,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  value: number | string;
  extra?: string;
  onClick?: () => void;
  active?: boolean;
  tile?: boolean;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-[var(--color-text)]">{title}</span>
        <span className="block truncate text-[12.5px] text-[#8e8e93]">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[16px] font-semibold tabular-nums text-[var(--color-text)]">{value}</span>
        {extra && <span className="block text-[12px] tabular-nums text-[#8e8e93]">{extra}</span>}
      </span>
      {onClick && active && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />}
    </>
  );
  const cls = "relative flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left";
  return (
    <div className="group/row relative">
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={active} className={clsx(cls, ROW_PRESS)}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
      <span className={ROW_SEPARATOR} style={{ left: tile ? 58 : 40 }} aria-hidden="true" />
    </div>
  );
}

/** Ota-ona qatori: avatar (faollik nuqtasi bilan), ism, farzandlari; o'ngda vaqt va oxirgi kirish */
function GuardianRow({ g, href, showBranch }: { g: EngagementGuardian; href: string; showBranch: boolean }) {
  const tr = useTr();
  const kids = g.children
    .map((c) => [tr(c.fullName), c.groupName ? tr(c.groupName) : null].filter(Boolean).join(", "))
    .join(" · ");
  const relation = g.children[0] ? tr(RELATION_LABEL[g.children[0].relation]) : "";
  const branch = showBranch ? g.children.find((c) => c.branchName)?.branchName : null;
  return (
    <div className="group/row relative">
      <Link href={href} className={clsx("flex min-h-[68px] items-center gap-3 py-2.5 pl-4 pr-3", ROW_PRESS)}>
        <span className="relative shrink-0">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold"
            style={{ backgroundColor: `${LEVEL_META[g.level].color}1f`, color: LEVEL_META[g.level].color }}
          >
            {initialsOf(g.fullName)}
          </span>
          <LevelDot level={g.level} />
        </span>
        <span className="min-w-0 flex-[1.3]">
          <span className="block truncate text-[15.5px] font-medium leading-snug text-[var(--color-text)]">{tr(g.fullName)}</span>
          <span className="block truncate text-[13px] leading-snug text-[#8e8e93]">
            {relation ? `${relation} · ` : ""}
            {kids}
          </span>
        </span>
        <span className="hidden w-[150px] min-w-0 shrink-0 lg:block">
          <span className="block truncate text-[15px] tabular-nums leading-snug text-[var(--color-text)]">{g.phone}</span>
          <span className="block truncate text-[13px] leading-snug text-[#8e8e93]">{branch ? tr(branch) : g.pushEnabled ? tr("Bildirishnoma yoqilgan") : tr("Bildirishnoma o'chiq")}</span>
        </span>
        <span className="hidden w-[150px] shrink-0 md:block">
          <span className="block text-[15px] tabular-nums leading-snug text-[var(--color-text)]">{formatDuration(g.secondsWeek, tr)}</span>
          <span className="block truncate text-[13px] leading-snug text-[#8e8e93]">{tr("haftada · {0}/30 kun faol", g.activeDays30)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end text-right">
          {g.connected ? (
            <>
              <span className="text-[13.5px] font-medium tabular-nums" style={{ color: LEVEL_META[g.level].color }}>
                {formatAgo(g.lastActivityAt, tr)}
              </span>
              <span className="text-[12.5px] tabular-nums text-[#8e8e93] md:hidden">{formatDuration(g.secondsWeek, tr)}</span>
              {g.unreadMessages > 0 && (
                <span className="hidden text-[12.5px] text-[#8e8e93] md:block">{tr("{0} o'qilmagan xabar", g.unreadMessages)}</span>
              )}
            </>
          ) : (
            <Pill color={IOS.gray}>{tr("Ochilmagan")}</Pill>
          )}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
      </Link>
      <span className={ROW_SEPARATOR} style={{ left: 72 }} aria-hidden="true" />
    </div>
  );
}
