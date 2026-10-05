"use client";

import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import type { IconProps } from "@/components/ui/icons";
import {
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  ChildIcon,
  DoorIcon,
  GroupIcon,
  MealIcon,
  NoteIcon,
  PhoneIcon,
  TeacherIcon,
} from "@/components/ui/icons";
import { Toast, type ToastState } from "@/components/ui/toast";
import { IosButton } from "@/components/ios/button";
import { Group, GroupLink, ListRow, Row } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import iosStyles from "@/components/ios/ios.module.css";
import { IosIcon, type IosTint } from "@/features/director/ios-icon";
import { MONTHS, WEEKDAYS, greeting, tashkentNow } from "@/features/director/director-home";
import { todayTashkent, type BoardResult, type WeeklyResult } from "@/features/desk/shared";
import { useTr } from "@/i18n/tr";

/** Ro'yxatda birdaniga ko'rsatiladigan guruhlar; qolgani "Yana ko'rsatish" bilan */
const PAGE = 10;

type StaffAway = BoardResult["staffAway"][number];

const STAFF_STATUS: Record<StaffAway["status"], { label: string; color: string }> = {
  ABSENT: { label: "Kelmagan", color: IOS.red },
  SICK: { label: "Kasal", color: IOS.orange },
  ON_LEAVE: { label: "Ta'tilda", color: IOS.blue },
};

interface GroupToday {
  id: string;
  name: string;
  teachers: string[];
  total: number;
  present: number;
  absent: number;
  sick: number;
  notMarked: number;
  pickedUp: number;
}

/**
 * Filial admini bosh sahifasi — iOS grouped (Settings) uslubida.
 *
 * Funksiyalar (avvalgi sahifadagilarning hammasi saqlangan):
 * - `/app/desk/board` — bugungi davomat, hozir bog'chada, ovqat porsiyasi,
 *   ishda yo'q xodimlar; har daqiqada o'zi yangilanadi;
 * - `/app/desk/weekly` — guruhlar (tarbiyachilari bilan) va shu haftadagi
 *   yangi arizalar;
 * - havolalar: Bugungi holat (board), Guruhlar, guruh sahifasi, Arizalar (CRM),
 *   shuningdek ovqatlanish, xodimlar davomati va asosiy bo'limlar;
 * - yangilash tugmasi va telefonda pastga tortib yangilash.
 * Qator bosilsa tafsilot varag'i ochiladi, guruh sahifasiga o'tish — varaq pastida.
 */
export function BranchAdminHome({ slug, branchName }: { slug: string; branchName: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const { hour, date: now } = tashkentNow();
  const date = todayTashkent();
  const firstName = user?.fullName.split(" ")[0] ?? "";

  const board = useQuery({
    queryKey: ["desk-board", slug, date],
    queryFn: () => api.get<BoardResult>(`/app/desk/board?date=${date}`),
    refetchInterval: 60_000,
  });
  const weekly = useQuery({
    queryKey: ["desk-weekly", slug, date],
    queryFn: () => api.get<WeeklyResult>(`/app/desk/weekly?from=${date}`),
  });

  const [shown, setShown] = useState(PAGE);
  const [openGroup, setOpenGroup] = useState<GroupToday | null>(null);
  const [openStaff, setOpenStaff] = useState<StaffAway | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);

  const refresh = useCallback(async () => {
    const results = await Promise.all([board.refetch(), weekly.refetch()]);
    const failed = results.some((r) => r.isError);
    setToast(failed ? { type: "error", message: tr("Yangilab bo'lmadi") } : { type: "success", message: tr("Yangilandi") });
  }, [board, weekly, tr]);

  const onRefreshClick = async () => {
    setManualRefresh(true);
    await refresh();
    setManualRefresh(false);
  };

  const b = board.data;
  const t = b?.totals;
  const boardByGroup = new Map((b?.groups ?? []).map((g) => [g.groupId, g]));
  // Guruhlar ro'yxati haftalik hisobotdan (tarbiyachilar shu yerda), bugungi
  // sonlar esa "Bugungi holat"dan — u har daqiqada yangilanadi
  const groups: GroupToday[] = (weekly.data?.groups ?? []).map((g) => {
    const today = boardByGroup.get(g.id);
    return {
      id: g.id,
      name: g.name,
      teachers: g.teachers,
      total: today?.total ?? g.childrenCount,
      present: today?.present ?? 0,
      absent: today?.absent ?? 0,
      sick: today?.sick ?? 0,
      notMarked: today?.notMarked ?? g.childrenCount,
      pickedUp: today?.pickedUp ?? 0,
    };
  });

  const percentOf = (n: number) => (t && t.total > 0 ? `${Math.round((n / t.total) * 100)}%` : undefined);

  const sections: { label: string; href: string; icon: ComponentType<IconProps>; tint: IosTint }[] = [
    { label: "Bolalar", href: `/${slug}/children`, icon: ChildIcon, tint: "blue" },
    { label: "Guruhlar", href: `/${slug}/groups`, icon: GroupIcon, tint: "indigo" },
    { label: "Xodimlar", href: `/${slug}/employees`, icon: TeacherIcon, tint: "purple" },
    { label: "Xodimlar davomati", href: `/${slug}/staff-attendance`, icon: CalendarIcon, tint: "teal" },
    { label: "Ovqatlanish", href: `/${slug}/nutrition`, icon: MealIcon, tint: "orange" },
    { label: "Arizalar (CRM)", href: `/${slug}/crm`, icon: PhoneIcon, tint: "green" },
    { label: "Xabarlar", href: `/${slug}/notifications`, icon: BellIcon, tint: "red" },
    { label: "Haftalik hisobot", href: `/${slug}/weekly-report`, icon: NoteIcon, tint: "gray" },
  ];

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <PageHeaderCard
          icon={BuildingIcon}
          title={tr(branchName)}
          count={t ? tr("{0} ta bola", t.total) : undefined}
          subtitle={
            <>
              {tr(WEEKDAYS[now.getUTCDay()])}, {now.getUTCDate()}-{tr(MONTHS[now.getUTCMonth()])} · {tr(greeting(hour))}
              {firstName && `, ${firstName}`}
            </>
          }
          actions={
            <>
              <IosButton label={tr("Yangilash")} icon={RefreshIcon} compact onClick={onRefreshClick} loading={manualRefresh} />
              <IosButton label={tr("Bugungi holat")} icon={ChartIcon} variant="primary" compact href={`/${slug}/board`} />
            </>
          }
        />

        {/* Bugungi davomat */}
        <Group
          title={tr("Bugungi davomat")}
          refreshing={board.isFetching && !board.isLoading && !manualRefresh}
          action={<GroupLink href={`/${slug}/board`}>{tr("Batafsil")}</GroupLink>}
          bare
        >
          {/* Xato ekrani faqat ma'lumot umuman bo'lmasa; aks holda eskisi qoladi, xato toast'da */}
          {board.isError && !board.data ? (
            <ErrorState message={(board.error as Error).message} onRetry={() => board.refetch()} retrying={board.isFetching} />
          ) : (
            <PageCard className="p-4 md:p-5">
              <div className="flex items-end justify-between gap-3 px-1">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--color-text)]">
                    {board.isLoading ? "—" : (t?.present ?? 0)}
                  </span>
                  <span className="text-[18px] font-semibold tabular-nums text-[#8e8e93]">/ {t?.total ?? 0}</span>
                  <span className="ml-1 text-[15px] text-[#8e8e93]">{tr("keldi")}</span>
                </p>
                {t && t.total > 0 && <Pill color={IOS.green}>{percentOf(t.present)}</Pill>}
              </div>
              <p className="mt-1.5 px-1 text-[13px] text-[#8e8e93]">
                {!t
                  ? tr("Yuklanmoqda…")
                  : t.total === 0
                    ? tr("Filialda hali bola yo'q")
                    : t.notMarked === t.total
                      ? tr("Davomat hali belgilanmagan")
                      : t.notMarked > 0
                        ? tr("{0} tasi hali belgilanmagan", t.notMarked)
                        : tr("Hamma bolalar belgilangan")}
              </p>
              <AttendanceBar total={t?.total ?? 0} present={t?.present ?? 0} sick={t?.sick ?? 0} absent={t?.absent ?? 0} />
              <StatStrip className="mt-4">
                <StatCell label={tr("Keldi")} value={t?.present ?? 0} hint={percentOf(t?.present ?? 0)} color={IOS.green} loading={board.isLoading} />
                <StatCell label={tr("Kelmadi")} value={t?.absent ?? 0} hint={percentOf(t?.absent ?? 0)} color={IOS.red} loading={board.isLoading} />
                <StatCell label={tr("Kasal")} value={t?.sick ?? 0} hint={percentOf(t?.sick ?? 0)} color={IOS.orange} loading={board.isLoading} />
                <StatCell label={tr("Belgilanmagan")} value={t?.notMarked ?? 0} hint={percentOf(t?.notMarked ?? 0)} color={IOS.gray} loading={board.isLoading} />
              </StatStrip>
            </PageCard>
          )}
        </Group>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
          {/* Guruhlar */}
          <Group
            title={
              <>
                {tr("Guruhlar")}
                {groups.length > 0 && <span className="font-normal normal-case tracking-normal">· {groups.length}</span>}
              </>
            }
            refreshing={weekly.isFetching && !weekly.isLoading && !manualRefresh}
            action={<GroupLink href={`/${slug}/groups`}>{tr("Barchasi")}</GroupLink>}
            bare
          >
            {weekly.isLoading ? (
              <SkeletonRows rows={5} />
            ) : weekly.isError && !weekly.data ? (
              <ErrorState message={(weekly.error as Error).message} onRetry={() => weekly.refetch()} retrying={weekly.isFetching} />
            ) : groups.length === 0 ? (
              <EmptyState icon={GroupIcon} title="Bu filialda hali guruh yo'q" />
            ) : (
              <div className={GROUP_BLOCK}>
                {groups.slice(0, shown).map((g) => (
                  <ListRow
                    key={g.id}
                    onClick={() => setOpenGroup(g)}
                    avatar={<IosAvatar name={g.name} letters={1} />}
                    title={tr(g.name)}
                    subtitle={`${tr("{0} ta bola", g.total)} · ${g.teachers.length > 0 ? g.teachers.join(", ") : tr("Tarbiyachi biriktirilmagan")}`}
                    meta={<GroupPill g={g} />}
                    chevron
                  />
                ))}
                {groups.length > shown && (
                  <Row title={<span className="text-[var(--color-primary)]">{tr("Yana ko'rsatish")}</span>} value={groups.length - shown} onClick={() => setShown((n) => n + PAGE)} chevron={false} />
                )}
              </div>
            )}
          </Group>

          <div className="min-w-0 space-y-5">
            {/* Bugun — ko'rsatkichlar */}
            <Group title={tr("Bugun")}>
              <Row
                href={`/${slug}/board`}
                leading={<IosIcon icon={DoorIcon} tint="teal" size={30} />}
                title={tr("Hozir bog'chada")}
                subtitle={b ? tr("{0} tasi olib ketilgan", b.totals.pickedUp) : undefined}
                value={<Value loading={board.isLoading}>{b?.stillHere ?? 0}</Value>}
              />
              <Row
                href={`/${slug}/nutrition`}
                leading={<IosIcon icon={MealIcon} tint="orange" size={30} />}
                title={tr("Ovqat porsiyasi")}
                subtitle={tr("kelgan + kechikkanlar")}
                value={<Value loading={board.isLoading}>{b?.mealCount ?? 0}</Value>}
              />
              <Row
                href={`/${slug}/staff-attendance`}
                leading={<IosIcon icon={TeacherIcon} tint="purple" size={30} />}
                title={tr("Kelmagan xodimlar")}
                value={
                  <Value loading={board.isLoading} color={b && b.staffAway.length > 0 ? IOS.red : undefined}>
                    {b?.staffAway.length ?? 0}
                  </Value>
                }
              />
              <Row
                href={`/${slug}/crm`}
                leading={<IosIcon icon={PhoneIcon} tint="green" size={30} />}
                title={tr("Yangi arizalar")}
                subtitle={tr("shu hafta landing sahifadan kelgan")}
                value={<Value loading={weekly.isLoading}>{weekly.data?.newLeads ?? 0}</Value>}
              />
            </Group>

            {/* Ishda yo'q xodimlar */}
            <Group title={tr("Bugun ishda yo'q")} bare={board.isLoading}>
              {board.isLoading ? (
                <SkeletonRows rows={2} />
              ) : !b || b.staffAway.length === 0 ? (
                <Row
                  leading={
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759]">
                      <CheckIcon className="h-4 w-4" strokeWidth={2.8} />
                    </span>
                  }
                  title={tr("Hamma xodimlar ishda")}
                  subtitle={tr("Bugun kelmagan yoki kasal xodim yo'q")}
                />
              ) : (
                b.staffAway.map((s, i) => {
                  const status = STAFF_STATUS[s.status];
                  return (
                    <ListRow
                      key={`${s.fullName}-${i}`}
                      onClick={() => setOpenStaff(s)}
                      avatar={<IosAvatar name={s.fullName} size={40} />}
                      title={s.fullName}
                      subtitle={tr(s.position)}
                      meta={<Pill color={status.color}>{tr(status.label)}</Pill>}
                      chevron
                    />
                  );
                })
              )}
            </Group>

            {/* Bo'limlar */}
            <Group title={tr("Bo'limlar")}>
              {sections.map((s) => (
                <Row key={s.href} href={s.href} leading={<IosIcon icon={s.icon} tint={s.tint} size={30} />} title={tr(s.label)} />
              ))}
            </Group>
          </div>
        </div>
      </div>

      {/* Guruh tafsiloti */}
      <IosSheet
        open={openGroup !== null}
        onClose={() => setOpenGroup(null)}
        cancelLabel="Yopish"
        title={openGroup ? tr(openGroup.name) : ""}
        footer={openGroup && <SheetPrimaryButton href={`/${slug}/groups/${openGroup.id}`}>{tr("Guruhni ochish")}</SheetPrimaryButton>}
      >
        {openGroup && (
          <>
            <section>
              <h3 className="px-4 pb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#6d6d72]">{tr("Bugun")}</h3>
              <StatStrip tone="white">
                <StatCell label={tr("Keldi")} value={openGroup.present} color={IOS.green} />
                <StatCell label={tr("Kelmadi")} value={openGroup.absent} color={IOS.red} />
                <StatCell label={tr("Kasal")} value={openGroup.sick} color={IOS.orange} />
                <StatCell label={tr("Belgilanmagan")} value={openGroup.notMarked} color={IOS.gray} />
              </StatStrip>
            </section>
            <SheetSection title={tr("Guruh")}>
              <SheetRow label={tr("Bolalar")}>{tr("{0} ta bola", openGroup.total)}</SheetRow>
              <SheetRow label={tr("Tarbiyachi")}>
                <span className="block truncate" title={openGroup.teachers.join(", ")}>
                  {openGroup.teachers.length > 0 ? openGroup.teachers.join(", ") : tr("Tarbiyachi biriktirilmagan")}
                </span>
              </SheetRow>
              <SheetRow label={tr("Olib ketilgan")}>{openGroup.pickedUp}</SheetRow>
            </SheetSection>
          </>
        )}
      </IosSheet>

      {/* Xodim tafsiloti */}
      <IosSheet
        open={openStaff !== null}
        onClose={() => setOpenStaff(null)}
        cancelLabel="Yopish"
        title={openStaff?.fullName ?? ""}
        footer={<SheetPrimaryButton href={`/${slug}/staff-attendance`}>{tr("Xodimlar davomati")}</SheetPrimaryButton>}
      >
        {openStaff && (
          <SheetSection title={tr("Bugun")}>
            <SheetRow label={tr("Lavozim")}>{tr(openStaff.position)}</SheetRow>
            <SheetRow label={tr("Holat")}>
              <Pill color={STAFF_STATUS[openStaff.status].color}>{tr(STAFF_STATUS[openStaff.status].label)}</Pill>
            </SheetRow>
          </SheetSection>
        )}
      </IosSheet>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Value({ children, loading, color }: { children: ReactNode; loading: boolean; color?: string }) {
  if (loading) return <span className="inline-block h-4 w-6 animate-pulse rounded bg-[#767680]/[0.14] align-middle" />;
  return (
    <span className="font-semibold" style={{ color: color ?? "var(--color-text)" }}>
      {children}
    </span>
  );
}

/** Guruhning bugungi holati: belgilanmagan — kulrang, aks holda "keldi/jami" */
function GroupPill({ g }: { g: GroupToday }) {
  const tr = useTr();
  if (g.total === 0) return null;
  if (g.notMarked === g.total) {
    // Telefonda ixcham ("—/15"), aks holda guruh nomi qisqarib ketadi
    return (
      <Pill color={IOS.gray} title={tr("Belgilanmagan")}>
        <span className="sm:hidden" aria-label={tr("Belgilanmagan")}>
          —/{g.total}
        </span>
        <span className="hidden sm:inline">{tr("Belgilanmagan")}</span>
      </Pill>
    );
  }
  const color = g.present === g.total ? IOS.green : g.absent + g.sick > 0 ? IOS.orange : IOS.green;
  return (
    <Pill color={color} title={tr("{0} tasi keldi", g.present)}>
      {g.present}/{g.total}
    </Pill>
  );
}

/** Keldi / kasal / kelmadi — bitta to'plangan chiziq */
function AttendanceBar({ total, present, sick, absent }: { total: number; present: number; sick: number; absent: number }) {
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
      <div className={`${iosStyles.grow} flex h-full`}>
        <span style={{ width: pct(present), background: IOS.green }} />
        <span style={{ width: pct(sick), background: IOS.orange }} />
        <span style={{ width: pct(absent), background: IOS.red }} />
      </div>
    </div>
  );
}

function RefreshIcon(props: IconProps) {
  const { filled: _filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" />
    </svg>
  );
}
