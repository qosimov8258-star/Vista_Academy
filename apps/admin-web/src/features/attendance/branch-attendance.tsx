"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckCheck, ClipboardCheck, Download, MessageCircle, PhoneCall, ScanFace, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AttendanceChild, AttendanceDay, AttendanceRangeSummary, AttendanceStatus, ChronicAbsenceFlag, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching } from "@/lib/permissions";
import { isAssistantPosition } from "@/lib/employee-position";
import { downloadCsv } from "@/lib/download";
import { IosButton } from "@/components/ios/button";
import { DayStepper, WEEKDAYS, dayMonthLabel } from "@/components/ios/day-stepper";
import { ChipRow, IosChip, SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { Group } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { ChildPhoto } from "@/components/ui/child-photo";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ChildNoteModal } from "@/features/child-notes/child-note-modal";
import { TodayRemindersCard } from "@/features/child-notes/today-reminders-card";
import { useTr } from "@/i18n/tr";

const TIMEZONE = "Asia/Tashkent";
const todayTashkent = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

const STATUSES: { value: AttendanceStatus; label: string; short: string; color: string }[] = [
  { value: "PRESENT", label: "Keldi", short: "Keldi", color: IOS.green },
  { value: "ABSENT", label: "Kelmadi", short: "Kelmadi", color: IOS.red },
  { value: "LATE", label: "Kech qoldi", short: "Kech", color: IOS.orange },
  { value: "SICK", label: "Kasal", short: "Kasal", color: "#af52de" },
];
const STATUS_META = Object.fromEntries(STATUSES.map((s) => [s.value, s])) as Record<AttendanceStatus, (typeof STATUSES)[number]>;

type StatusFilter = "all" | AttendanceStatus;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** Bola holati: 4 ta kapsula (telefonda qatorning to'liq kengligida) */
function StatusPicker({ value, onChange, size = "row" }: { value: AttendanceStatus; onChange: (s: AttendanceStatus) => void; size?: "row" | "sheet" }) {
  const tr = useTr();
  return (
    <div role="radiogroup" aria-label={tr("Holat")} className={clsx("grid grid-cols-4 gap-[3px] rounded-full bg-[#767680]/[0.12] p-[3px]", size === "row" ? "w-full sm:w-[300px]" : "w-full")}>
      {STATUSES.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s.value)}
            className={clsx(
              "flex items-center justify-center rounded-full font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.95]",
              size === "row" ? "h-9 text-[13px]" : "h-11 text-[15px]",
              active ? "text-white shadow-sm" : "text-[#6d6d72] hover:text-[var(--color-text)]",
            )}
            style={active ? { backgroundColor: s.color } : undefined}
          >
            {tr(size === "row" ? s.short : s.label)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filial admini / administrator / direktor uchun bolalar davomati — iOS
 * uslubida. Kun tanlanadi (istalgan o'tgan kun qayta ochilib tuzatiladi,
 * kelajak kun yo'q). Belgilanmagan kunda hamma "Keldi" deb turadi —
 * faqat kelmaganlarni o'zgartirib, pastdagi "Saqlash" bosiladi; serverga
 * faqat o'zgarganlar bitta so'rovda yuboriladi.
 */
export function BranchAttendance({ slug }: { slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  // Tarbiyachi yordamchisi davomatni faqat ko'radi — belgilash tarbiyachiniki
  const canWrite = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));

  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [sheetChildId, setSheetChildId] = useState<string | null>(null);
  const [noteChild, setNoteChild] = useState<{ id: string; name: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // "Bugun" brauzer soatiga bog'liq — server va mijoz farq qilmasin
  useEffect(() => {
    const t = todayTashkent();
    setToday(t);
    setDate((d) => d || t);
  }, []);

  const orgQuery = useQuery({ queryKey: ["org", slug], queryFn: () => api.get<Organization>("/app/organizations/me") });
  const branches = orgQuery.data?.branches ?? [];
  const branchId = forcedBranchId ?? (selectedBranchId || branches[0]?.id || "");

  const attendanceQuery = useQuery({
    queryKey: ["attendance", slug, branchId, date],
    queryFn: () => api.get<AttendanceDay>(`/app/attendance?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });
  const summaryQuery = useQuery({
    queryKey: ["attendance-summary", slug, branchId],
    queryFn: () => api.get<AttendanceRangeSummary>(`/app/attendance/summary?branchId=${branchId}`),
    enabled: !!branchId,
  });
  // Ketma-ket 3+ kun kelmagan yoki to'lov muddati o'tgan-va-bugun kelmagan bolalar
  const chronicQuery = useQuery({
    queryKey: ["chronic-absences", slug, branchId],
    queryFn: () => api.get<ChronicAbsenceFlag[]>(`/app/attendance/chronic-absences?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const chronic = useMemo(() => new Map((chronicQuery.data ?? []).map((f) => [f.childId, f])), [chronicQuery.data]);

  const children = useMemo(() => attendanceQuery.data?.children ?? [], [attendanceQuery.data]);
  const saved = useMemo(() => new Map(children.map((c) => [c.childId, c])), [children]);
  const markedCount = children.filter((c) => c.status !== null).length;

  // Mahalliy (hali saqlanmagan) holatlar — faqat filial+sana almashganda
  // yoki saqlangandan keyin serverdagidan qayta to'ldiriladi; fon
  // yangilanishi terilgan belgilarni o'chirib yubormasin.
  const [local, setLocal] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    const data = attendanceQuery.data;
    if (!data || data.date !== date) return;
    const key = `${branchId}_${date}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;
    setLocal(Object.fromEntries(data.children.map((c) => [c.childId, { status: c.status ?? "PRESENT", note: c.note ?? "" }])));
  }, [attendanceQuery.data, date, branchId]);

  const statusOf = (id: string): AttendanceStatus => local[id]?.status ?? saved.get(id)?.status ?? "PRESENT";
  const noteOf = (id: string) => local[id]?.note ?? saved.get(id)?.note ?? "";
  const setStatus = (id: string, status: AttendanceStatus) => setLocal((s) => ({ ...s, [id]: { status, note: s[id]?.note ?? "" } }));
  const setNote = (id: string, note: string) => setLocal((s) => ({ ...s, [id]: { status: s[id]?.status ?? "PRESENT", note } }));

  /** Serverga ketadiganlar: belgilanmaganlar va o'zgarganlar */
  const changes = useMemo(
    () =>
      children
        .filter((c) => {
          const l = local[c.childId];
          if (!l) return c.status === null;
          return c.status === null || l.status !== c.status || (l.note || "") !== (c.note || "");
        })
        .map((c) => ({ childId: c.childId, status: statusOf(c.childId), note: noteOf(c.childId).trim() || undefined })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children, local],
  );
  /** Foydalanuvchi shu kunda biror narsani o'zgartirganmi (sukutdagi "Keldi"dan tashqari) */
  const touched = children.some((c) => {
    const l = local[c.childId];
    return !!l && (l.status !== (c.status ?? "PRESENT") || (l.note || "") !== (c.note || ""));
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post<{ saved: number }>("/app/attendance/bulk", { date, items: changes }),
    onSuccess: async () => {
      initializedFor.current = null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-summary", slug, branchId] }),
        queryClient.invalidateQueries({ queryKey: ["chronic-absences", slug, branchId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] }),
      ]);
    },
  });

  // Ota-ona sabab qoldirmagan bo'lsa — administratorga bildirishnoma
  const contactMutation = useMutation({
    mutationFn: (childId: string) => api.post("/app/attendance/request-contact", { childId, date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] }),
  });

  // Kun/filial almashganda — eski "Saqlandi"/xato xabari yangi kunga osilmasin
  useEffect(() => {
    saveMutation.reset();
    setSheetChildId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  /** Saqlanmagan o'zgarish bo'lsa — avval so'raymiz */
  const goToDate = (next: string) => {
    if (next === date) return;
    if (canWrite && touched) {
      setPendingDate(next);
      return;
    }
    setDate(next);
  };

  const counts = useMemo(() => {
    const out: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, SICK: 0 };
    for (const c of children) out[statusOf(c.childId)] += 1;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, local]);

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of children) m.set(c.groupName ?? "Guruhsiz", (m.get(c.groupName ?? "Guruhsiz") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [children]);

  const q = search.trim().toLowerCase();
  const visible = children.filter(
    (c) =>
      (!q || c.fullName.toLowerCase().includes(q)) &&
      (statusFilter === "all" || statusOf(c.childId) === statusFilter) &&
      (!groupFilter || (c.groupName ?? "Guruhsiz") === groupFilter),
  );
  const sections = useMemo(() => {
    const m = new Map<string, AttendanceChild[]>();
    for (const c of visible) m.set(c.groupName ?? "Guruhsiz", [...(m.get(c.groupName ?? "Guruhsiz") ?? []), c]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((c) => c.childId).join(","), local]);

  const sheetChild = sheetChildId ? (saved.get(sheetChildId) ?? null) : null;
  const loading = !date || !branchId || attendanceQuery.isLoading;
  const year = today ? Number(today.slice(0, 4)) : undefined;

  return (
    <div className="-mx-2 md:mx-0" ref={topRef}>
      <PullToRefresh onRefresh={() => Promise.all([attendanceQuery.refetch(), summaryQuery.refetch(), chronicQuery.refetch()])} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={ClipboardCheck}
          tint="green"
          title={tr("Davomat")}
          count={children.length ? `${counts.PRESENT + counts.LATE}/${children.length}` : undefined}
          subtitle={tr("Bolalarning kunlik qatnashuvi")}
          actions={<IosButton label={tr("Eksport")} icon={Download} compact onClick={() => setExportOpen(true)} disabled={!branchId} />}
        />

        {!forcedBranchId && branches.length > 1 && (
          <ChipRow label={tr("Filial")}>
            {branches.map((b) => (
              <IosChip key={b.id} active={b.id === branchId} onClick={() => setSelectedBranchId(b.id)}>
                {tr(b.name)}
              </IosChip>
            ))}
          </ChipRow>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {date && today && <DayStepper value={date} onChange={goToDate} today={today} max={today} />}
          {!loading && children.length > 0 && (
            <Pill color={markedCount === 0 ? IOS.orange : markedCount < children.length ? IOS.orange : IOS.green}>
              {markedCount === 0 ? tr("Hali belgilanmagan") : markedCount < children.length ? tr("{0}/{1} belgilangan", markedCount, children.length) : tr("Belgilangan")}
            </Pill>
          )}
        </div>

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        {branchId && date && <TodayRemindersCard slug={slug} branchId={branchId} today={date} />}

        <StatStrip tone="white">
          {STATUSES.map((s) => (
            <StatCell
              key={s.value}
              label={tr(s.label)}
              value={counts[s.value]}
              color={counts[s.value] ? s.color : undefined}
              hint={children.length ? `${Math.round((counts[s.value] / children.length) * 100)}%` : undefined}
              loading={loading}
            />
          ))}
        </StatStrip>

        {canWrite && !loading && markedCount === 0 && children.length > 0 && (
          <p className="px-4 text-[13px] leading-snug text-[#8e8e93]">
            {tr("Hamma «Keldi» deb turibdi — faqat kelmaganlarni o'zgartirib, pastdagi «Saqlash»ni bosing.")}
          </p>
        )}
        {canWrite && !loading && markedCount > 0 && date !== today && (
          <p className="px-4 text-[13px] leading-snug text-[#8e8e93]">{tr("Bu kun belgilangan — o'zgartirib, qayta saqlashingiz mumkin.")}</p>
        )}

        {orgQuery.isError && !branchId ? (
          <ErrorState message={(orgQuery.error as Error).message} onRetry={() => orgQuery.refetch()} retrying={orgQuery.isFetching} />
        ) : !branchId && orgQuery.isSuccess ? (
          <EmptyState icon={ClipboardCheck} title="Filial mavjud emas" />
        ) : attendanceQuery.isError ? (
          <ErrorState message={(attendanceQuery.error as Error).message} onRetry={() => attendanceQuery.refetch()} retrying={attendanceQuery.isFetching} />
        ) : loading ? (
          <Group title={tr("Bolalar")} bare>
            <SkeletonRows rows={6} />
          </Group>
        ) : children.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Bu filialda faol bola yo'q" />
        ) : (
          <>
            <div className="space-y-3">
              <SearchPill value={search} onChange={setSearch} placeholder={tr("Bola ismi bo'yicha qidirish")} />
              <ChipRow label={tr("Holat")}>
                <IosChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")} count={children.length}>
                  {tr("Hammasi")}
                </IosChip>
                {STATUSES.filter((s) => s.value !== "PRESENT").map((s) => (
                  <IosChip key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)} count={counts[s.value]}>
                    {tr(s.label)}
                  </IosChip>
                ))}
              </ChipRow>
              {groups.length > 1 && (
                <ChipRow label={tr("Guruh")}>
                  <IosChip active={!groupFilter} onClick={() => setGroupFilter(null)}>
                    {tr("Barcha guruhlar")}
                  </IosChip>
                  {groups.map(([name, n]) => (
                    <IosChip key={name} active={groupFilter === name} onClick={() => setGroupFilter(groupFilter === name ? null : name)} count={n}>
                      {tr(name)}
                    </IosChip>
                  ))}
                </ChipRow>
              )}
            </div>

            {sections.length === 0 ? (
              <p className={clsx(GROUP_BLOCK, "px-4 py-8 text-center text-[14px] text-[#8e8e93]")}>{tr("Bu tanlovda bola yo'q")}</p>
            ) : (
              sections.map(([group, rows]) => {
                const here = rows.filter((c) => ["PRESENT", "LATE"].includes(statusOf(c.childId))).length;
                return (
                  <Group
                    key={group}
                    title={
                      <>
                        {tr(group)} <span className="tabular-nums">· {here}/{rows.length}</span>
                      </>
                    }
                    action={
                      canWrite && rows.some((c) => statusOf(c.childId) !== "PRESENT") ? (
                        <button type="button" className="text-[var(--color-primary)] active:opacity-50" onClick={() => rows.forEach((c) => setStatus(c.childId, "PRESENT"))}>
                          {tr("Hammasi keldi")}
                        </button>
                      ) : undefined
                    }
                  >
                    {rows.map((c) => (
                      <ChildRow
                        key={c.childId}
                        child={c}
                        status={statusOf(c.childId)}
                        note={noteOf(c.childId)}
                        changed={c.status !== null && (statusOf(c.childId) !== c.status || noteOf(c.childId) !== (c.note ?? ""))}
                        flag={chronic.get(c.childId)}
                        canWrite={canWrite}
                        onStatus={(s) => setStatus(c.childId, s)}
                        onOpen={() => setSheetChildId(c.childId)}
                      />
                    ))}
                  </Group>
                );
              })
            )}

            {/* Asosiy maydonning pastki ichki chegarasi (telefonda pastki menyu uchun) sticky masofaga qo'shiladi — shuning uchun 0 */}
            {canWrite && (
              <div className="sticky bottom-0 z-10 md:bottom-2">
                <div className="flex items-center gap-3 rounded-[22px] bg-white/90 p-2 pl-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.04] backdrop-blur-xl">
                  <div className="min-w-0 flex-1">
                    {saveMutation.isError ? (
                      <p className="truncate text-[13px] font-medium text-[#ff3b30]">
                        {saveMutation.error instanceof ApiError ? tr(saveMutation.error.message) : tr("Saqlashda xatolik yuz berdi")}
                      </p>
                    ) : changes.length > 0 ? (
                      <>
                        <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                          {markedCount === 0 ? tr("{0} ta bola belgilanadi", changes.length) : tr("{0} ta o'zgarish", changes.length)}
                        </p>
                        <p className="truncate text-[12px] text-[#8e8e93]">{tr("Hali saqlanmagan")}</p>
                      </>
                    ) : (
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-[#34c759]">
                        <CheckCheck className="h-4 w-4" strokeWidth={2.4} />
                        {tr("Hammasi saqlangan")}
                      </p>
                    )}
                  </div>
                  <IosButton label={tr("Saqlash")} variant="primary" loading={saveMutation.isPending} disabled={changes.length === 0} onClick={() => saveMutation.mutate()} />
                </div>
              </div>
            )}
          </>
        )}

        {/* So'nggi 14 kun — kun bosilsa o'sha kun ochiladi (tuzatish uchun) */}
        <Group title={tr("So'nggi 14 kun")} footer={canWrite ? tr("Kunni bosing — o'sha kun ochiladi va tuzatsa bo'ladi.") : undefined} bare={summaryQuery.isLoading || !summaryQuery.data}>
          {summaryQuery.isLoading || !summaryQuery.data ? (
            <SkeletonRows rows={4} avatar={false} />
          ) : (
            [...summaryQuery.data.days].reverse().map((d) => {
              const total = summaryQuery.data.totalChildren || 1;
              const active = d.date === date;
              return (
                <div key={d.date} className="group/row relative">
                  <button
                    type="button"
                    onClick={() => {
                      goToDate(d.date);
                      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={clsx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left", ROW_PRESS, active && "bg-[var(--color-primary)]/[0.06]")}
                  >
                    <span className="w-[112px] shrink-0">
                      <span className="block text-[15px] text-[var(--color-text)]">{dayMonthLabel(d.date, tr, year)}</span>
                      <span className="block text-[12px] text-[#8e8e93]">{tr(WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()])}</span>
                    </span>
                    <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#767680]/[0.12]" aria-hidden="true">
                      <span style={{ width: `${(d.present / total) * 100}%`, backgroundColor: IOS.green }} />
                      <span style={{ width: `${(d.absent / total) * 100}%`, backgroundColor: IOS.red }} />
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums">
                      <span className="font-semibold text-[#34c759]">{d.present}</span>
                      <span className="font-semibold text-[#ff3b30]">{d.absent}</span>
                      {d.unmarked > 0 && <span className="text-[#8e8e93] max-sm:hidden">{tr("{0} belgilanmagan", d.unmarked)}</span>}
                    </span>
                  </button>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </div>
              );
            })
          )}
        </Group>
      </div>

      {/* Bola varag'i: holat, izoh, Face ID, ota-ona sababi, aloqa */}
      <IosSheet
        open={!!sheetChild}
        onClose={() => setSheetChildId(null)}
        title={sheetChild ? tr(sheetChild.fullName) : ""}
        cancelLabel="Yopish"
        footer={<SheetPrimaryButton onClick={() => setSheetChildId(null)}>{tr("Tayyor")}</SheetPrimaryButton>}
      >
        {sheetChild && (
          <>
            {canWrite ? (
              <SheetSection title={tr("Holat")} footer={tr("O'zgarish pastdagi «Saqlash» bilan saqlanadi.")}>
                <div className="space-y-3 p-3">
                  <StatusPicker value={statusOf(sheetChild.childId)} onChange={(s) => setStatus(sheetChild.childId, s)} size="sheet" />
                  <input
                    type="text"
                    value={noteOf(sheetChild.childId)}
                    maxLength={500}
                    onChange={(e) => setNote(sheetChild.childId, e.target.value)}
                    placeholder={tr("Izoh (ixtiyoriy)")}
                    className="h-11 w-full rounded-[12px] bg-[#767680]/[0.08] px-3.5 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#8e8e93] focus:bg-[#767680]/[0.12]"
                  />
                </div>
              </SheetSection>
            ) : (
              <SheetSection title={tr("Holat")}>
                <SheetRow label={tr("Holat")}>
                  {sheetChild.status ? <Pill color={STATUS_META[sheetChild.status].color}>{tr(STATUS_META[sheetChild.status].label)}</Pill> : tr("Belgilanmagan")}
                </SheetRow>
                {sheetChild.note && <SheetRow label={tr("Izoh")}>{tr(sheetChild.note)}</SheetRow>}
              </SheetSection>
            )}
            <SheetSection title={tr("Ma'lumot")}>
              <SheetRow label={tr("Guruh")}>{sheetChild.groupName ? tr(sheetChild.groupName) : "—"}</SheetRow>
              <SheetRow label={tr("Face ID")}>
                {sheetChild.checkInTime ? `${sheetChild.checkInTime}${sheetChild.checkOutTime ? ` — ${sheetChild.checkOutTime}` : ""}` : tr("Qayd yo'q")}
              </SheetRow>
              {sheetChild.parentReason && <SheetRow label={tr("Ota-ona sababi")}>{tr(sheetChild.parentReason)}</SheetRow>}
              {(chronic.get(sheetChild.childId)?.consecutiveAbsentDays ?? 0) >= 3 && (
                <SheetRow label={tr("Diqqat")}>
                  <span className="text-[#ff3b30]">{tr("{0} kun ketma-ket kelmadi", chronic.get(sheetChild.childId)?.consecutiveAbsentDays ?? 0)}</span>
                </SheetRow>
              )}
              {sheetChild.contactRequestedAt && <SheetRow label={tr("Aloqa")}>{tr("Aloqaga chiqish so'raldi")}</SheetRow>}
            </SheetSection>
            {canWrite && (
              <div className="space-y-2.5">
                {sheetChild.status === "ABSENT" && !sheetChild.parentReason && !sheetChild.contactRequestedAt && (
                  <SheetSecondaryButton onClick={() => contactMutation.mutate(sheetChild.childId)}>
                    <PhoneCall className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    {contactMutation.isPending ? tr("Yuborilmoqda…") : tr("Aloqaga chiqishni so'rash")}
                  </SheetSecondaryButton>
                )}
                <SheetSecondaryButton onClick={() => setNoteChild({ id: sheetChild.childId, name: sheetChild.fullName })}>
                  <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  {tr("Xabar / eslatma")}
                </SheetSecondaryButton>
              </div>
            )}
          </>
        )}
      </IosSheet>

      {/* Saqlanmagan o'zgarish bilan boshqa kunga o'tish */}
      <IosSheet
        open={!!pendingDate}
        onClose={() => setPendingDate(null)}
        title={tr("Saqlanmagan o'zgarishlar")}
        footer={
          <div className="space-y-2.5">
            <SheetPrimaryButton
              loading={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate(undefined, {
                  onSuccess: () => {
                    if (pendingDate) setDate(pendingDate);
                    setPendingDate(null);
                  },
                })
              }
            >
              {tr("Saqlab, o'tish")}
            </SheetPrimaryButton>
            <SheetSecondaryButton
              danger
              onClick={() => {
                if (pendingDate) setDate(pendingDate);
                setPendingDate(null);
              }}
            >
              {tr("Saqlamasdan o'tish")}
            </SheetSecondaryButton>
          </div>
        }
      >
        <p className="flex items-start gap-3 rounded-[14px] bg-[#ff9500]/[0.12] px-4 py-3 text-[14px] leading-snug text-[var(--color-text)]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ff9500]" strokeWidth={2.2} />
          {tr("Bu kunda {0} ta o'zgarish hali saqlanmagan.", changes.length)}
        </p>
      </IosSheet>

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} branchId={branchId} date={date} today={today} />

      {canWrite && noteChild && branchId && date && (
        <ChildNoteModal open onClose={() => setNoteChild(null)} slug={slug} branchId={branchId} childId={noteChild.id} childName={noteChild.name} date={date} />
      )}
    </div>
  );
}

function ChildRow({
  child,
  status,
  note,
  changed,
  flag,
  canWrite,
  onStatus,
  onOpen,
}: {
  child: AttendanceChild;
  status: AttendanceStatus;
  note: string;
  changed: boolean;
  flag?: ChronicAbsenceFlag;
  canWrite: boolean;
  onStatus: (s: AttendanceStatus) => void;
  onOpen: () => void;
}) {
  const tr = useTr();
  const shown = canWrite ? status : child.status;
  const sub = [
    child.checkInTime ? `${tr("Face ID")} ${child.checkInTime}${child.checkOutTime ? `–${child.checkOutTime}` : ""}` : null,
    child.parentReason ? `${tr("Ota-ona")}: ${child.parentReason}` : null,
    note || null,
  ].filter(Boolean);
  return (
    <div className="group/row relative">
      <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
        <button type="button" onClick={onOpen} className={clsx("-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-[12px] px-2 py-0.5 text-left", ROW_PRESS)}>
          <span className="relative shrink-0">
            <ChildPhoto child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }} size={40} fallback={initials(child.fullName)} />
            {changed && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#007aff] ring-2 ring-white" aria-label={tr("O'zgartirildi")} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-medium text-[var(--color-text)]">{tr(child.fullName)}</span>
              {child.checkInTime && <ScanFace className="h-3.5 w-3.5 shrink-0 text-[#34c759]" strokeWidth={2.4} aria-hidden="true" />}
            </span>
            {sub.length > 0 && <span className="block truncate text-[12.5px] text-[#8e8e93]">{sub.join(" · ")}</span>}
            {flag && (flag.consecutiveAbsentDays >= 3 || flag.overdueAndAbsentToday) && (
              <span className="mt-1 flex flex-wrap gap-1">
                {flag.consecutiveAbsentDays >= 3 && <Pill color={IOS.red}>{tr("{0} kun ketma-ket kelmadi", flag.consecutiveAbsentDays)}</Pill>}
                {flag.overdueAndAbsentToday && <Pill color={IOS.red}>{tr("To'lov muddati o'tgan")}</Pill>}
              </span>
            )}
          </span>
        </button>
        {canWrite ? (
          <StatusPicker value={status} onChange={onStatus} />
        ) : (
          <span className="shrink-0 self-start sm:self-center">
            {shown ? <Pill color={STATUS_META[shown].color}>{tr(STATUS_META[shown].label)}</Pill> : <Pill>{tr("Belgilanmagan")}</Pill>}
          </span>
        )}
      </div>
      <span className={ROW_SEPARATOR} style={{ left: 68 }} aria-hidden="true" />
    </div>
  );
}

/** CSV eksport: tanlangan kun yoki sana oralig'i */
function ExportSheet({ open, onClose, branchId, date, today }: { open: boolean; onClose: () => void; branchId: string; date: string; today: string }) {
  const tr = useTr();
  const [mode, setMode] = useState<"day" | "range">("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFrom((f) => f || date);
    setTo((t) => t || date);
  }, [open, date]);

  const run = async () => {
    if (mode === "range" && (!from || !to || from > to)) {
      setError(tr("Oraliqni to'g'ri tanlang"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "range") await downloadCsv(`/app/exports/attendance?from=${from}&to=${to}&branchId=${branchId}`, `davomat-${from}_${to}.csv`);
      else await downloadCsv(`/app/exports/attendance?date=${date}&branchId=${branchId}`, `davomat-${date}.csv`);
      onClose();
    } catch {
      setError(tr("Eksport qilib bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setBusy(false);
    }
  };

  const dateInput = "w-full bg-transparent text-right text-[15px] text-[var(--color-text)] outline-none";
  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Davomat eksporti")}
      footer={
        <SheetPrimaryButton onClick={run} loading={busy}>
          {tr("Yuklab olish (CSV)")}
        </SheetPrimaryButton>
      }
    >
      <SheetSection>
        <div className="p-3">
          <Segmented<"day" | "range">
            value={mode}
            onChange={setMode}
            label={tr("Davr")}
            options={[
              { value: "day", label: tr("Tanlangan kun") },
              { value: "range", label: tr("Oraliq") },
            ]}
          />
        </div>
        {mode === "day" ? (
          <SheetRow label={tr("Kun")}>{date ? dayMonthLabel(date, tr) : "—"}</SheetRow>
        ) : (
          <>
            <SheetRow label={tr("Dan")}>
              <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} className={dateInput} aria-label={tr("Dan")} />
            </SheetRow>
            <SheetRow label={tr("Gacha")}>
              <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} className={dateInput} aria-label={tr("Gacha")} />
            </SheetRow>
          </>
        )}
      </SheetSection>
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
    </IosSheet>
  );
}
