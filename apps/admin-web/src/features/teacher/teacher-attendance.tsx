"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceDay, AttendanceRangeSummary, AttendanceStatus, ChronicAbsenceFlag } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { isAssistantPosition } from "@/lib/employee-position";
import { useBranchContext } from "@/lib/use-branch-context";
import { downloadCsv } from "@/lib/download";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { CalendarIcon, CheckIcon, ChecklistIcon, DocumentIcon, NoteIcon } from "@/components/ui/icons";
import { ChildNoteModal } from "@/features/child-notes/child-note-modal";
import { EmptyRow, FloatingBar, Group, LargeTitle, PrimaryButton, Row, Segmented, SkeletonRows, TeacherPage, formatDayLong, formatDayShort, todayIso } from "./teacher-ui";
import { TeacherReminders } from "./teacher-reminders";
import styles from "./teacher.module.css";

const STATUS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "PRESENT", label: "Keldi", color: "var(--color-success)" },
  { value: "ABSENT", label: "Kelmadi", color: "var(--color-danger)" },
  { value: "LATE", label: "Kech qoldi", color: "var(--color-warning)" },
  { value: "SICK", label: "Kasal", color: "var(--color-warning)" },
];
const STATUS_BY_VALUE = Object.fromEntries(STATUS.map((s) => [s.value, s])) as Record<AttendanceStatus, (typeof STATUS)[number]>;

/**
 * Tarbiyachining kunlik davomati — telefon uchun: har bola alohida qatorda,
 * ostida iOS segmented control (Keldi / Kelmadi / Kech qoldi / Kasal).
 * Hamma "Keldi" bo'lib ochiladi — faqat istisnolarni o'zgartirib, pastdagi
 * suzib turuvchi "Saqlash" bosiladi. Mantiq filial admini sahifasi bilan
 * bir xil (o'sha API, o'sha kesh kalitlari).
 */
export function TeacherAttendance({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const branchId = forcedBranchId ?? user?.branchId ?? "";
  // Yordamchi davomatni faqat ko'radi — belgilash tarbiyachiniki
  const canWrite = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));

  // "Bugun" foydalanuvchi soatiga bog'liq — server va brauzer farq qilmasin
  const [date, setDate] = useState("");
  useEffect(() => setDate((d) => d || todayIso()), []);
  const [tab, setTab] = useState<"all" | "absent">("all");
  const [noteChild, setNoteChild] = useState<{ id: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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
  const chronicQuery = useQuery({
    queryKey: ["chronic-absences", slug, branchId],
    queryFn: () => api.get<ChronicAbsenceFlag[]>(`/app/attendance/chronic-absences?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const chronicByChild = new Map((chronicQuery.data ?? []).map((f) => [f.childId, f]));

  // Mahalliy belgilar faqat filial+sana haqiqatan almashganda qayta to'ldiriladi —
  // oyna qayta fokuslanib so'rov yangilansa, saqlanmagan belgilar o'chib ketmasin.
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    const data = attendanceQuery.data;
    if (!data || data.date !== date) return;
    const key = `${branchId}_${date}`;
    if (initializedFor.current === key) return;
    initializedFor.current = key;
    setLocalStatuses(Object.fromEntries(data.children.map((c) => [c.childId, c.status ?? "PRESENT"])));
    setLocalNotes(Object.fromEntries(data.children.map((c) => [c.childId, c.note ?? ""])));
  }, [attendanceQuery.data, date, branchId]);
  const statusFor = (id: string) => localStatuses[id] ?? "PRESENT";
  const noteFor = (id: string) => localNotes[id] ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceQuery.data) return;
      await Promise.all(
        attendanceQuery.data.children.map((child) =>
          api.post("/app/attendance", { childId: child.childId, date, status: statusFor(child.childId), note: noteFor(child.childId) }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary", slug, branchId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
  });
  useEffect(() => {
    saveMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  // Ota-ona sabab qoldirmagan bo'lsa — filial administratoriga "aloqaga chiqing" xabari
  const contactMutation = useMutation({
    mutationFn: (childId: string) => api.post("/app/attendance/request-contact", { childId, date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] }),
  });

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/attendance?date=${date}&branchId=${branchId}`, `davomat-${date}.csv`);
    } catch {
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
    } finally {
      setExporting(false);
    }
  };

  const children = attendanceQuery.data?.children ?? [];
  const absentChildren = children.filter((c) => c.status === "ABSENT");
  // Saqlanmagan o'zgarishlar: serverdagi holatdan farq qiladigan (yoki hali yozilmagan) bolalar
  const unsaved = children.filter((c) => c.status !== statusFor(c.childId) || (c.note ?? "") !== noteFor(c.childId)).length;
  const counts = STATUS.map((s) => ({ ...s, count: children.filter((c) => statusFor(c.childId) === s.value).length }));
  const isToday = date === todayIso();

  return (
    <TeacherPage className="pb-4">
      <LargeTitle
        eyebrow={date ? formatDayLong(date) : " "}
        title="Davomat"
        trailing={
          // Tabiiy sana tanlagich ko'rinmas holda kapsula ustida turadi — telefonda o'z g'ildiragi ochiladi
          <label className="relative flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-3.5 text-[15px] font-medium text-[var(--color-primary)] shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-transform active:scale-95">
            <CalendarIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            {date ? (isToday ? "Bugun" : formatDayShort(date)) : "…"}
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Sanani tanlash"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        }
      />

      {/* Jonli hisob — belgilar o'zgarishi bilan yangilanadi */}
      {children.length > 0 && (
        <div className={clsx(styles.group, "grid grid-cols-4 divide-x divide-[var(--color-separator)] py-3.5")}>
          {counts.map((c) => (
            <div key={c.value} className="flex flex-col items-center gap-0.5 px-1">
              <span className="text-[24px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: c.count ? c.color : "var(--color-text-muted)" }}>
                {c.count}
              </span>
              <span className="truncate text-[12px] font-medium text-[var(--color-text-muted)]">{c.label}</span>
            </div>
          ))}
        </div>
      )}

      {branchId && date && <TeacherReminders slug={slug} branchId={branchId} date={date} />}

      <div className="space-y-3">
        <Segmented
          label="Ro'yxat"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "Hammasi" },
            { value: "absent", label: `Kelmaganlar${absentChildren.length ? ` (${absentChildren.length})` : ""}` },
          ]}
        />

        {!date || attendanceQuery.isLoading || (!branchId && !user) ? (
          <Group>
            <SkeletonRows rows={5} />
          </Group>
        ) : attendanceQuery.isError ? (
          <Group>
            <EmptyRow title="Yuklab bo'lmadi" description={(attendanceQuery.error as Error).message} />
          </Group>
        ) : children.length === 0 ? (
          <Group>
            <EmptyRow icon={ChecklistIcon} title="Guruhda faol bola yo'q" />
          </Group>
        ) : tab === "absent" ? (
          <Group footer="Ota-ona sabab yozmagan bo'lsa, «Aloqaga chiqish» filial administratoriga xabar yuboradi.">
            {absentChildren.length === 0 ? (
              <EmptyRow icon={CheckIcon} title="Hammasi keldi" description="Bu kunda kelmagan bola yo'q" />
            ) : (
              absentChildren.map((child, i) => (
                <Row
                  key={child.childId}
                  first={i === 0}
                  leading={<ChildPhoto child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }} size={40} fallback={initials(child.fullName)} />}
                  title={child.fullName}
                  subtitle={child.parentReason ? `Ota-ona: ${child.parentReason}` : child.note || "Sabab yozilmagan"}
                  trailing={
                    child.parentReason ? undefined : child.contactRequestedAt ? (
                      <span className="shrink-0 text-[13px] font-medium text-[var(--color-warning)]">So&apos;raldi</span>
                    ) : canWrite ? (
                      <button
                        type="button"
                        disabled={contactMutation.isPending && contactMutation.variables === child.childId}
                        onClick={() => contactMutation.mutate(child.childId)}
                        className="shrink-0 cursor-pointer rounded-full bg-[var(--color-primary)]/10 px-3 py-1.5 text-[13.5px] font-semibold text-[var(--color-primary)] transition-opacity active:opacity-60 disabled:opacity-50"
                      >
                        Aloqaga chiqish
                      </button>
                    ) : undefined
                  }
                />
              ))
            )}
          </Group>
        ) : (
          <Group footer={canWrite ? undefined : "Davomatni tarbiyachi belgilaydi — siz faqat ko'rasiz."}>
            {children.map((child, i) => {
              const status = statusFor(child.childId);
              const flag = chronicByChild.get(child.childId);
              const flags = [
                flag && flag.consecutiveAbsentDays >= 3 ? `${flag.consecutiveAbsentDays} kun ketma-ket kelmadi` : null,
                flag?.overdueAndAbsentToday ? "To'lov muddati o'tgan" : null,
              ].filter(Boolean);
              return (
                <div key={child.childId} className="relative px-4 py-3">
                  {i > 0 && <span className="absolute left-[68px] right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                  <div className="flex items-center gap-3">
                    <ChildPhoto
                      child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }}
                      size={40}
                      fallback={initials(child.fullName)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] leading-snug text-[var(--color-text)]">{child.fullName}</p>
                      {flags.length > 0 ? (
                        <p className="truncate text-[13px] font-medium text-[var(--color-danger)]">{flags.join(" · ")}</p>
                      ) : child.checkInTime ? (
                        // Yuz tanish terminali qayd etgan vaqt
                        <p className="truncate text-[13px] font-medium text-[var(--color-success)]">
                          Face ID · {child.checkInTime}
                          {child.checkOutTime ? ` – ${child.checkOutTime}` : ""}
                        </p>
                      ) : (
                        child.groupName && <p className="truncate text-[13px] text-[var(--color-text-muted)]">{child.groupName}</p>
                      )}
                    </div>
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => setNoteChild({ id: child.childId, name: child.fullName })}
                        aria-label={`${child.fullName}: xabar yoki eslatma`}
                        className="-mr-1.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-primary)] transition-colors active:bg-black/5"
                      >
                        <NoteIcon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                      </button>
                    ) : (
                      <span className="shrink-0 text-[14px] font-semibold" style={{ color: child.status ? STATUS_BY_VALUE[child.status].color : "var(--color-text-muted)" }}>
                        {child.status ? STATUS_BY_VALUE[child.status].label : "Belgilanmagan"}
                      </span>
                    )}
                  </div>
                  {canWrite && (
                    <div className="mt-2.5 space-y-2 sm:pl-[52px]">
                      <Segmented
                        size="sm"
                        label={`${child.fullName} — holat`}
                        value={status}
                        onChange={(value) => setLocalStatuses((s) => ({ ...s, [child.childId]: value }))}
                        options={STATUS.map((s) => ({ value: s.value, label: s.label, tint: s.color }))}
                      />
                      {status !== "PRESENT" && (
                        <input
                          type="text"
                          value={noteFor(child.childId)}
                          onChange={(e) => setLocalNotes((s) => ({ ...s, [child.childId]: e.target.value }))}
                          placeholder="Izoh (ixtiyoriy)"
                          className="h-10 w-full rounded-[10px] bg-[rgba(118,118,128,0.12)] px-3 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                        />
                      )}
                    </div>
                  )}
                  {!canWrite && child.note && <p className="mt-1 pl-[52px] text-[13px] text-[var(--color-text-muted)]">{child.note}</p>}
                </div>
              );
            })}
          </Group>
        )}
      </div>

      <Group title="So'nggi 14 kun">
        {summaryQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : !summaryQuery.data || summaryQuery.data.totalChildren === 0 ? (
          <EmptyRow title="Ma'lumot yo'q" />
        ) : (
          // Eng yangi kun tepada
          [...summaryQuery.data.days].reverse().map((day, i) => {
            const all = Math.max(day.present + day.absent + day.unmarked, 1);
            return (
              <div key={day.date} className="relative flex items-center gap-3 px-4 py-2.5">
                {i > 0 && <span className="absolute left-4 right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                <span className="w-[92px] shrink-0 text-[14.5px] text-[var(--color-text)]">{formatDayShort(day.date)}</span>
                <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(118,118,128,0.14)]" aria-hidden="true">
                  <span className="h-full bg-[var(--color-success)]" style={{ width: `${(day.present / all) * 100}%` }} />
                  <span className="h-full bg-[var(--color-danger)]" style={{ width: `${(day.absent / all) * 100}%` }} />
                </span>
                <span className="w-[58px] shrink-0 text-right text-[14px] tabular-nums">
                  <span className={clsx("font-semibold", day.present ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]")}>{day.present}</span>
                  <span className="text-[var(--color-text-muted)]"> / </span>
                  <span className={clsx("font-semibold", day.absent ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]")}>{day.absent}</span>
                </span>
              </div>
            );
          })
        )}
      </Group>

      <Group footer={exportError ? <span className="text-[var(--color-danger)]">{exportError}</span> : "Tanlangan kun davomati Excel'da ochiladigan fayl bo'lib yuklanadi."}>
        <Row
          first
          icon={DocumentIcon}
          title="CSV yuklab olish"
          onClick={exporting || !date ? undefined : handleExport}
          value={exporting ? "Yuklanmoqda…" : undefined}
          chevron={!exporting}
        />
      </Group>

      {canWrite && noteChild && branchId && date && (
        <ChildNoteModal
          open
          onClose={() => setNoteChild(null)}
          slug={slug}
          branchId={branchId}
          childId={noteChild.id}
          childName={noteChild.name}
          date={date}
        />
      )}
      {/* Saqlash — tab-bar ustida doim qo'l ostida */}
      {canWrite && tab === "all" && children.length > 0 && (
        <FloatingBar>
          <PrimaryButton loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={unsaved === 0 && saveMutation.isSuccess}>
            {saveMutation.isPending ? "Saqlanmoqda…" : unsaved === 0 && saveMutation.isSuccess ? (
              <>
                <CheckIcon className="h-5 w-5" strokeWidth={2.6} /> Saqlandi
              </>
            ) : unsaved > 0 && children.some((c) => c.status) ? (
              `Saqlash · ${unsaved} ta o'zgarish`
            ) : (
              "Saqlash"
            )}
          </PrimaryButton>
          {saveMutation.isError && <p className="mt-1.5 text-center text-[13px] font-medium text-[var(--color-danger)]">Saqlashda xatolik — qayta urinib ko&apos;ring</p>}
        </FloatingBar>
      )}
    </TeacherPage>
  );
}
