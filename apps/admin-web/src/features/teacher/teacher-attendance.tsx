"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import clsx from "clsx";
import { FileSpreadsheet, Thermometer } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceDay, AttendanceRangeSummary, AttendanceStatus, ChronicAbsenceFlag } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { isAssistantPosition } from "@/lib/employee-position";
import { useBranchContext } from "@/lib/use-branch-context";
import { ReportSheet } from "@/features/reports/report-sheet";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { CheckIcon, ChecklistIcon, ClockIcon, CloseIcon, NoteIcon, PhoneIcon, type IconProps } from "@/components/ios/icons";
import { IOS } from "@/components/ios/tokens";
import { Pill } from "@/components/ios/pill";
import { DayStepper } from "@/components/ios/day-stepper";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { ChildNoteModal } from "@/features/child-notes/child-note-modal";
import { EmptyRow, FloatingBar, Group, LargeTitle, PrimaryButton, Row, SkeletonRows, TeacherPage, formatDayLong, formatDayShort, todayIso } from "./teacher-ui";
import { TeacherReminders } from "./teacher-reminders";
import { GUIDE_VIDEOS } from "./guides";
import { GuideRow, GuideSheet } from "./guide-sheet";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

// Ranglar filial admini sahifasi bilan bir xil (features/attendance/branch-attendance.tsx)
const STATUS: { value: AttendanceStatus; label: string; color: string; icon: ComponentType<IconProps> }[] = [
  { value: "PRESENT", label: "Keldi", color: IOS.green, icon: CheckIcon },
  { value: "ABSENT", label: "Kelmadi", color: IOS.red, icon: CloseIcon },
  { value: "LATE", label: "Kech qoldi", color: IOS.orange, icon: ClockIcon },
  { value: "SICK", label: "Kasal", color: "#af52de", icon: Thermometer },
];
const STATUS_BY_VALUE = Object.fromEntries(STATUS.map((s) => [s.value, s])) as Record<AttendanceStatus, (typeof STATUS)[number]>;

type Child = AttendanceDay["children"][number];

/**
 * Tarbiyachining kunlik davomati — telefon uchun. Har bola bitta qatorda:
 * o'ngdagi yumaloq tugma bir bosishda Keldi ↔ Kelmadi almashtiradi, qatorning
 * o'zi bosilsa pastdan varaq ochiladi (4 holat, izoh, eslatma, aloqa).
 * Hamma "Keldi" bo'lib ochiladi — faqat istisnolar o'zgartirilib, "Saqlash"
 * bosiladi. Tepadagi hisoblagichlar ro'yxatni holat bo'yicha suzadi.
 * Mantiq filial admini sahifasi bilan bir xil (o'sha API, o'sha kesh kalitlari).
 */
export function TeacherAttendance({ slug }: { slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const branchId = forcedBranchId ?? user?.branchId ?? "";
  // Yordamchi davomatni faqat ko'radi — belgilash tarbiyachiniki
  const canWrite = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));

  // "Bugun" foydalanuvchi soatiga bog'liq — server va brauzer farq qilmasin
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const t = todayIso();
    setToday(t);
    setDate((d) => d || t);
  }, []);
  const [filter, setFilter] = useState<AttendanceStatus | null>(null);
  const [sheetChildId, setSheetChildId] = useState<string | null>(null);
  const [noteChild, setNoteChild] = useState<{ id: string; name: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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
  const setStatus = (id: string, status: AttendanceStatus) => setLocalStatuses((s) => ({ ...s, [id]: status }));

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
    setFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  // Ota-ona sabab qoldirmagan bo'lsa — filial administratoriga "aloqaga chiqing" xabari
  const contactMutation = useMutation({
    mutationFn: (childId: string) => api.post("/app/attendance/request-contact", { childId, date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] }),
  });

  const children = attendanceQuery.data?.children ?? [];
  // Saqlanmagan o'zgarishlar: serverdagi holatdan farq qiladigan (yoki hali yozilmagan) bolalar
  const unsaved = children.filter((c) => c.status !== statusFor(c.childId) || (c.note ?? "") !== noteFor(c.childId)).length;
  const daySaved = children.some((c) => c.status);
  // Tarbiyachi — o'zi belgilayotgan holat; yordamchi — faqat saqlangani (belgilanmagan hisobga kirmaydi)
  const effectiveStatus = (c: Child): AttendanceStatus | null => (canWrite ? statusFor(c.childId) : (c.status ?? null));
  const counts = STATUS.map((s) => ({ ...s, count: children.filter((c) => effectiveStatus(c) === s.value).length }));
  const shown = filter ? children.filter((c) => effectiveStatus(c) === filter) : children;
  const sheetChild = children.find((c) => c.childId === sheetChildId) ?? null;
  const showSaveBar = canWrite && children.length > 0 && (unsaved > 0 || !daySaved || saveMutation.isPending || saveMutation.isSuccess || saveMutation.isError);

  /** Qator izohi: muhim belgilar → ota-ona sababi → Face ID vaqti → izoh → guruh */
  const subtitleFor = (child: Child) => {
    const flag = chronicByChild.get(child.childId);
    const flags = [
      flag && flag.consecutiveAbsentDays >= 3 ? tr("{0} kun ketma-ket kelmadi", flag.consecutiveAbsentDays) : null,
      flag?.overdueAndAbsentToday ? tr("To'lov muddati o'tgan") : null,
    ].filter(Boolean);
    if (flags.length) return <span className="font-medium text-[var(--color-danger)]">{flags.join(" · ")}</span>;
    if (child.parentReason) return <span className="text-[var(--color-text)]">{tr("Ota-ona: {0}", child.parentReason)}</span>;
    if (child.checkInTime) {
      return (
        <span className="font-medium text-[var(--color-success)]">
          {tr("Face ID ·")} {child.checkInTime}
          {child.checkOutTime ? ` – ${child.checkOutTime}` : ""}
        </span>
      );
    }
    const note = noteFor(child.childId);
    if (note) return note;
    if (child.contactRequestedAt) return <span className="text-[var(--color-warning)]">{tr("Aloqa so'raldi")}</span>;
    if (statusFor(child.childId) === "ABSENT") return tr("Sabab yozilmagan");
    return child.groupName ? tr(child.groupName) : null;
  };

  return (
    <TeacherPage className="pb-4">
      <LargeTitle eyebrow={date ? formatDayLong(date) : " "} title={tr("Davomat")} />

      {date && today && <DayStepper value={date} onChange={setDate} today={today} max={today} />}

      <GuideRow title="Davomat qilish yo'riqnomasi" subtitle="Qanday belgilash — 1 daqiqada" onOpen={() => setGuideOpen(true)} />

      {/* Jonli hisob — bosilsa ro'yxat shu holat bo'yicha suziladi */}
      {children.length > 0 && (
        <div className={clsx(styles.group, "grid grid-cols-4 gap-1 p-1.5")} role="radiogroup" aria-label={tr("Holat bo'yicha suzish")}>
          {counts.map((c) => {
            const active = filter === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFilter(active ? null : c.value)}
                className="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] px-1 transition-[background-color,transform] active:scale-[0.97]"
                style={{ backgroundColor: active ? `${c.color}1f` : undefined }}
              >
                <span className="text-[24px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: c.count ? c.color : "var(--color-text-muted)" }}>
                  {c.count}
                </span>
                <span className={clsx("max-w-full truncate text-[12px]", active ? "font-semibold" : "font-medium")} style={{ color: active ? c.color : "var(--color-text-muted)" }}>
                  {tr(c.label)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {branchId && date && <TeacherReminders slug={slug} branchId={branchId} date={date} />}

      <Group
        title={filter ? tr(STATUS_BY_VALUE[filter].label) : tr("Bolalar")}
        action={
          filter ? (
            <button type="button" onClick={() => setFilter(null)} className="cursor-pointer text-[15px] font-medium text-[var(--color-primary)] active:opacity-50">
              {tr("Hammasi")}
            </button>
          ) : children.length > 0 ? (
            <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">{children.length}</span>
          ) : undefined
        }
        footer={
          !canWrite
            ? tr("Davomatni tarbiyachi belgilaydi — siz faqat ko'rasiz.")
            : children.length > 0
              ? tr("O'ngdagi belgi: Keldi ↔ Kelmadi. Kech qoldi, Kasal va izoh — bolani bosing.")
              : undefined
        }
      >
        {!date || attendanceQuery.isLoading || (!branchId && !user) ? (
          <SkeletonRows rows={6} />
        ) : attendanceQuery.isError ? (
          <EmptyRow title={tr("Yuklab bo'lmadi")} description={tr((attendanceQuery.error as Error).message)} />
        ) : children.length === 0 ? (
          <EmptyRow icon={ChecklistIcon} title={tr("Guruhda faol bola yo'q")} />
        ) : shown.length === 0 ? (
          <EmptyRow icon={CheckIcon} title={tr("Bu holatda bola yo'q")} description={filter === "ABSENT" ? tr("Bu kunda kelmagan bola yo'q") : undefined} />
        ) : (
          shown.map((child, i) => {
            const status = statusFor(child.childId);
            const meta = STATUS_BY_VALUE[status];
            // Kun hali saqlanmagan bo'lsa hammasi "yangi" — nuqta faqat saqlangan kunni o'zgartirganda
            const changed = daySaved && (child.status !== status || (child.note ?? "") !== noteFor(child.childId));
            return (
              <div key={child.childId} className="relative flex items-center">
                {i > 0 && <span className="absolute left-[72px] right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => setSheetChildId(child.childId)}
                  className={clsx(styles.pressable, "flex min-h-[64px] min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-2.5 pl-4 pr-2 text-left")}
                >
                  <span className="relative shrink-0">
                    <ChildPhoto
                      child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }}
                      size={44}
                      fallback={initials(child.fullName)}
                    />
                    {changed && canWrite && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--color-primary)]" aria-label={tr("Saqlanmagan")} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] leading-snug text-[var(--color-text)]">{tr(child.fullName)}</span>
                    <span className="mt-0.5 block truncate text-[13.5px] leading-snug text-[var(--color-text-muted)]">{subtitleFor(child) ?? " "}</span>
                  </span>
                </button>
                {canWrite ? (
                  // Bir bosishda eng ko'p kerak bo'ladigan almashtirish: Keldi ↔ Kelmadi
                  <button
                    type="button"
                    onClick={() => setStatus(child.childId, status === "PRESENT" ? "ABSENT" : "PRESENT")}
                    aria-label={tr("{0}: {1}. Almashtirish", child.fullName, tr(meta.label))}
                    className="mr-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-90"
                    style={status === "PRESENT" ? { backgroundColor: meta.color } : { backgroundColor: `${meta.color}1f`, boxShadow: `inset 0 0 0 2px ${meta.color}` }}
                  >
                    <meta.icon className="h-[22px] w-[22px]" strokeWidth={2.6} style={{ color: status === "PRESENT" ? "#fff" : meta.color }} />
                  </button>
                ) : (
                  <span className="mr-4 shrink-0">
                    {child.status ? <Pill color={STATUS_BY_VALUE[child.status].color}>{tr(STATUS_BY_VALUE[child.status].label)}</Pill> : <Pill>{tr("Belgilanmagan")}</Pill>}
                  </span>
                )}
              </div>
            );
          })
        )}
      </Group>

      <Group title={tr("So'nggi 14 kun")}>
        {summaryQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : !summaryQuery.data || summaryQuery.data.totalChildren === 0 ? (
          <EmptyRow title={tr("Ma'lumot yo'q")} />
        ) : (
          // Eng yangi kun tepada; kun bosilsa — o'sha kun ochiladi
          [...summaryQuery.data.days].reverse().map((day, i) => {
            const all = Math.max(day.present + day.absent + day.unmarked, 1);
            const current = day.date === date;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => {
                  setDate(day.date);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={clsx(styles.pressable, "relative flex min-h-[48px] w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left")}
              >
                {i > 0 && <span className="absolute left-4 right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                <span className={clsx("w-[92px] shrink-0 text-[14.5px]", current ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text)]")}>{formatDayShort(day.date)}</span>
                <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(118,118,128,0.14)]" aria-hidden="true">
                  <span className="h-full" style={{ width: `${(day.present / all) * 100}%`, backgroundColor: IOS.green }} />
                  <span className="h-full" style={{ width: `${(day.absent / all) * 100}%`, backgroundColor: IOS.red }} />
                </span>
                <span className="w-[58px] shrink-0 text-right text-[14px] tabular-nums">
                  <span className="font-semibold" style={{ color: day.present ? IOS.green : "var(--color-text-muted)" }}>{day.present}</span>
                  <span className="text-[var(--color-text-muted)]"> / </span>
                  <span className="font-semibold" style={{ color: day.absent ? IOS.red : "var(--color-text-muted)" }}>{day.absent}</span>
                </span>
              </button>
            );
          })
        )}
      </Group>

      <Group footer={tr("Kun, hafta yoki oy tanlanadi — har bola bo'yicha jamlanma, tabel va batafsil ro'yxat.")}>
        <Row first icon={FileSpreadsheet} title={tr("Excel hisobot yuklab olish")} onClick={date ? () => setReportOpen(true) : undefined} />
      </Group>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        period={date.slice(0, 7) || undefined}
        title="Davomat hisoboti"
        endpoint="/app/attendance/report"
        filePrefix="bolalar-davomati"
        formats={["xlsx"]}
        params={{ branchId }}
        allHint="Boshidan bugungacha barcha davomat yozuvlari"
        contents="Excel: «Umumiy» — har bola bo'yicha kelgan, kech qolgan, kelmagan va kasal kunlar hamda davomat foizi; «Tabel» — har kun holat rangida (Face ID bilan kelganda — kelish vaqti); «Kunlar» — har kuni nechta bola kelgani; «Batafsil» — har bir yozuv, izoh va ota-ona sababi bilan."
      />

      <ChildSheet
        child={sheetChild}
        onClose={() => setSheetChildId(null)}
        canWrite={canWrite}
        status={sheetChild ? statusFor(sheetChild.childId) : "PRESENT"}
        note={sheetChild ? noteFor(sheetChild.childId) : ""}
        flagText={(() => {
          const flag = sheetChild ? chronicByChild.get(sheetChild.childId) : undefined;
          return [
            flag && flag.consecutiveAbsentDays >= 3 ? tr("{0} kun ketma-ket kelmadi", flag.consecutiveAbsentDays) : null,
            flag?.overdueAndAbsentToday ? tr("To'lov muddati o'tgan") : null,
          ]
            .filter(Boolean)
            .join(" · ");
        })()}
        onStatus={(s) => sheetChild && setStatus(sheetChild.childId, s)}
        onNote={(text) => sheetChild && setLocalNotes((n) => ({ ...n, [sheetChild.childId]: text }))}
        onWriteNote={() => {
          if (!sheetChild) return;
          setNoteChild({ id: sheetChild.childId, name: sheetChild.fullName });
          setSheetChildId(null);
        }}
        contact={{
          pending: contactMutation.isPending && contactMutation.variables === sheetChild?.childId,
          error: contactMutation.isError && contactMutation.variables === sheetChild?.childId,
          onRequest: () => sheetChild && contactMutation.mutate(sheetChild.childId),
        }}
      />

      <GuideSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        intro="Davomat har kuni ertalab, bolalar kelgach belgilanadi. Asosiysi — kelmaganlarni belgilang va «Saqlash»ni bosing."
        steps={GUIDE_STEPS.map((step) => ({ ...step, token: step.token ? <GuideToken status={step.token} /> : undefined }))}
        tip="Maslahat: tepadagi raqamlarni bossangiz, faqat o'sha holatdagi bolalar qoladi. Face ID orqali kelgan bolada kelgan vaqti yashil yozuvda ko'rinadi."
        videoUrl={GUIDE_VIDEOS.attendance}
      />

      {canWrite && noteChild && branchId && date && (
        <ChildNoteModal open onClose={() => setNoteChild(null)} slug={slug} branchId={branchId} childId={noteChild.id} childName={noteChild.name} date={date} />
      )}

      {/* Saqlash — faqat saqlanmagan o'zgarish bo'lsa (yoki kun hali saqlanmagan bo'lsa), tab-bar ustida */}
      {showSaveBar && (
        <FloatingBar>
          <PrimaryButton loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={unsaved === 0 && daySaved}>
            {saveMutation.isPending ? (
              "Saqlanmoqda…"
            ) : unsaved === 0 && daySaved ? (
              <>
                <CheckIcon className="h-5 w-5" strokeWidth={2.6} /> {tr("Saqlandi")}
              </>
            ) : daySaved ? (
              tr("Saqlash · {0} ta o'zgarish", unsaved)
            ) : (
              tr("Davomatni saqlash · {0} bola", children.length)
            )}
          </PrimaryButton>
          {saveMutation.isError && <p className="mt-1.5 text-center text-[13px] font-medium text-[var(--color-danger)]">{tr("Saqlashda xatolik — qayta urinib ko'ring")}</p>}
        </FloatingBar>
      )}
    </TeacherPage>
  );
}

/**
 * Bitta bola varag'i: 4 holat katta tugmalarda, izoh, Face ID vaqti,
 * ota-ona sababi, "Aloqaga chiqish" va eslatma yozish. O'zgarish darhol
 * ro'yxatga tushadi — saqlash sahifadagi umumiy "Saqlash" bilan.
 */
function ChildSheet({
  child,
  onClose,
  canWrite,
  status,
  note,
  flagText,
  onStatus,
  onNote,
  onWriteNote,
  contact,
}: {
  child: Child | null;
  onClose: () => void;
  canWrite: boolean;
  status: AttendanceStatus;
  note: string;
  flagText: string;
  onStatus: (status: AttendanceStatus) => void;
  onNote: (text: string) => void;
  onWriteNote: () => void;
  contact: { pending: boolean; error: boolean; onRequest: () => void };
}) {
  const tr = useTr();
  const savedAbsent = child?.status === "ABSENT";
  return (
    <IosSheet
      open={!!child}
      onClose={onClose}
      cancelLabel="Yopish"
      title={child ? tr(child.fullName) : ""}
      footer={canWrite ? <SheetPrimaryButton onClick={onClose}>{tr("Tayyor")}</SheetPrimaryButton> : undefined}
    >
      {child && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2 pt-1">
            <ChildPhoto child={{ id: child.childId, fullName: child.fullName, gender: child.gender, avatarUpdatedAt: child.avatarUpdatedAt }} size={72} fallback={initials(child.fullName)} />
            {child.groupName && <p className="text-[13px] text-[#8e8e93]">{tr(child.groupName)}</p>}
            {flagText && <Pill color={IOS.red}>{flagText}</Pill>}
          </div>

          {canWrite ? (
            <section>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={tr("Holat")}>
                {STATUS.map((s) => {
                  const active = status === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onStatus(s.value)}
                      className="flex h-[56px] cursor-pointer items-center justify-center gap-2 rounded-[16px] text-[16px] font-semibold transition-[background-color,transform] active:scale-[0.97]"
                      style={active ? { backgroundColor: s.color, color: "#fff" } : { backgroundColor: "#fff", color: s.color }}
                    >
                      <s.icon className="h-5 w-5" strokeWidth={2.4} />
                      {tr(s.label)}
                    </button>
                  );
                })}
              </div>
              {status !== "PRESENT" && (
                <input
                  type="text"
                  value={note}
                  onChange={(e) => onNote(e.target.value)}
                  placeholder={tr("Izoh (ixtiyoriy)")}
                  className="mt-2.5 h-12 w-full rounded-[14px] bg-white px-4 text-[16px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6] focus:ring-2 focus:ring-[var(--color-primary)]/30"
                />
              )}
            </section>
          ) : (
            <SheetSection>
              <SheetRow label={tr("Holat")}>
                {child.status ? <Pill color={STATUS_BY_VALUE[child.status].color}>{tr(STATUS_BY_VALUE[child.status].label)}</Pill> : tr("Belgilanmagan")}
              </SheetRow>
              {child.note && <SheetRow label={tr("Izoh")}>{tr(child.note)}</SheetRow>}
            </SheetSection>
          )}

          {(child.checkInTime || child.parentReason) && (
            <SheetSection>
              {child.checkInTime && (
                <SheetRow label={tr("Face ID")}>
                  <span className="tabular-nums" style={{ color: IOS.green }}>
                    {child.checkInTime}
                    {child.checkOutTime ? ` – ${child.checkOutTime}` : ""}
                  </span>
                </SheetRow>
              )}
              {child.parentReason && <SheetRow label={tr("Ota-ona")}>{tr(child.parentReason)}</SheetRow>}
            </SheetSection>
          )}

          {/* Ota-ona sabab yozmagan, saqlangan "Kelmadi" — filial administratoriga xabar */}
          {savedAbsent && !child.parentReason && (
            <SheetSection footer={tr("Ota-ona sabab yozmagan bo'lsa, «Aloqaga chiqish» filial administratoriga xabar yuboradi.")}>
              {child.contactRequestedAt ? (
                <SheetRow label={tr("Aloqa")}>
                  <span style={{ color: IOS.orange }}>{tr("So'raldi")}</span>
                </SheetRow>
              ) : canWrite ? (
                <button
                  type="button"
                  disabled={contact.pending}
                  onClick={contact.onRequest}
                  className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 px-4 text-left text-[16px] text-[var(--color-primary)] active:bg-black/[0.04] disabled:opacity-50"
                >
                  <PhoneIcon className="h-5 w-5" strokeWidth={2} />
                  {contact.pending ? tr("Yuborilmoqda…") : tr("Aloqaga chiqish")}
                </button>
              ) : (
                <SheetRow label={tr("Aloqa")}>{tr("So'ralmagan")}</SheetRow>
              )}
            </SheetSection>
          )}
          {contact.error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr("Yuborib bo'lmadi — qayta urinib ko'ring")}</p>}

          {canWrite && (
            <SheetSecondaryButton onClick={onWriteNote}>
              <span className="inline-flex items-center gap-2">
                <NoteIcon className="h-[18px] w-[18px]" strokeWidth={2} />
                {tr("Xabar yoki eslatma yozish")}
              </span>
            </SheetSecondaryButton>
          )}
        </div>
      )}
    </IosSheet>
  );
}

/** Yo'riqnomadagi kichik "tugma" — sahifadagi haqiqiy belgining o'zi, tanib olish oson bo'lsin */
function GuideToken({ status }: { status: AttendanceStatus }) {
  const meta = STATUS_BY_VALUE[status];
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full align-middle"
      style={status === "PRESENT" ? { backgroundColor: meta.color } : { backgroundColor: `${meta.color}1f`, boxShadow: `inset 0 0 0 2px ${meta.color}` }}
      aria-hidden="true"
    >
      <meta.icon className="h-4 w-4" strokeWidth={2.8} style={{ color: status === "PRESENT" ? "#fff" : meta.color }} />
    </span>
  );
}

const GUIDE_STEPS: { title: string; text: string; token?: AttendanceStatus }[] = [
  { title: "Hamma bola — «Keldi»", text: "Sahifa ochilganda hamma bola avtomatik keldi deb turadi.", token: "PRESENT" },
  { title: "Kelmaganini belgilang", text: "Kelmagan bolaning o'ngidagi yashil belgini bir marta bosing — qizil «Kelmadi» bo'ladi. Yana bossangiz qaytadi.", token: "ABSENT" },
  { title: "Kech qoldi yoki kasal bo'lsa", text: "Bolaning ismini bosing — oyna ochiladi. «Kech qoldi» yoki «Kasal»ni tanlang, xohlasangiz izoh yozing va «Tayyor»ni bosing.", token: "SICK" },
  { title: "«Saqlash»ni bosing", text: "Pastdagi «Saqlash» tugmasini bosmaguningizcha davomat yozilmaydi. Ko'k nuqta — hali saqlanmagan o'zgarish." },
  { title: "Ota-ona sabab yozmagan bo'lsa", text: "Kelmagan bolani bosib «Aloqaga chiqish»ni tanlang — administrator ota-onaga qo'ng'iroq qiladi." },
];
