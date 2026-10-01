"use client";

import { TopbarAction } from "@/components/layout/topbar-action";
import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AttendanceDay, AttendanceRangeSummary, AttendanceStatus, ChronicAbsenceFlag, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import clsx from "clsx";
import { canWriteTeaching, isTeacher } from "@/lib/permissions";
import { isAssistantPosition } from "@/lib/employee-position";
import { ChildNoteModal } from "@/features/child-notes/child-note-modal";
import { TodayRemindersCard } from "@/features/child-notes/today-reminders-card";
import { TeacherAttendance } from "@/features/teacher/teacher-attendance";
import { useTr } from "@/i18n/tr";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

const CHILD_ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Keldi",
  ABSENT: "Kelmadi",
  LATE: "Kech qoldi",
  SICK: "Kasal",
};

const STATUS_SEGMENT_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: "PRESENT", label: "Keldi", activeClass: "bg-[var(--color-success)] text-white" },
  { value: "ABSENT", label: "Kelmadi", activeClass: "bg-[var(--color-danger)] text-white" },
  { value: "LATE", label: "Kech qoldi", activeClass: "bg-[var(--color-warning)] text-white" },
  { value: "SICK", label: "Kasal", activeClass: "bg-[var(--color-warning)] text-white" },
];

/** Bitta ixcham, to'liq dumaloq konteynerga to'plangan holat tanlovi — 4 ta
 * alohida keng tugma o'rniga, iOS segmented control uslubida. */
function StatusSegmented({
  value,
  onChange,
}: {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
}) {
  const tr = useTr();
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-[var(--color-surface-sunken)] p-1">
      {STATUS_SEGMENT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors duration-[var(--dur-fast)]",
            value === opt.value
              ? opt.activeClass
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-border)]",
          )}
        >
          {tr(opt.label)}
        </button>
      ))}
    </div>
  );
}

/**
 * Tarbiyachi (va yordamchi) telefon uchun qilingan o'z ko'rinishini oladi;
 * filial admini, administrator va direktor — jadvalli to'liq sahifani.
 */
export default function AttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (isTeacher(user?.role)) return <TeacherAttendance slug={slug} />;
  return <BranchAttendance slug={slug} />;
}

function BranchAttendance({ slug }: { slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  const [tab, setTab] = useState<"all" | "absent">("all");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date input.
  const [date, setDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Ikkalasi to'ldirilsa — sana oralig'i eksporti; bo'lmasa yuqoridagi
  // bitta "Sana" bo'yicha eksport qilinadi.
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const { user } = useAuth();
  // Tarbiyachi yordamchisi davomatni faqat ko'radi — belgilash tarbiyachiniki.
  const canWrite = canWriteTeaching(user?.role) && !(user?.position && isAssistantPosition(user.position));
  const [noteChild, setNoteChild] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setDate((current) => current || todayDateString());
  }, []);

  const handleExport = async () => {
    // Oraliqning faqat bittasi to'ldirilgan bo'lsa — jim tarzda bitta
    // kunlik eksportga o'tish o'rniga aniq xato ko'rsatamiz, aks holda
    // foydalanuvchi oraliqni so'raganini bilmay qoladi.
    if ((exportFrom && !exportTo) || (!exportFrom && exportTo)) {
      setExportError(tr("Sana oralig'i uchun ham \"dan\", ham \"gacha\" ni to'ldiring"));
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      if (exportFrom && exportTo) {
        await downloadCsv(
          `/app/exports/attendance?from=${exportFrom}&to=${exportTo}&branchId=${branchId}`,
          `davomat-${exportFrom}_${exportTo}.csv`,
        );
      } else {
        await downloadCsv(`/app/exports/attendance?date=${date}&branchId=${branchId}`, `davomat-${date}.csv`);
      }
    } catch {
      setExportError(tr("Eksport qilib bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setExporting(false);
    }
  };

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const branches = orgQuery.data?.branches ?? [];

  useEffect(() => {
    if (forcedBranchId) {
      setBranchId(forcedBranchId);
      return;
    }
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [forcedBranchId, branchId, branches]);

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

  // Ketma-ket 3+ kun kelmagan yoki to'lov muddati o'tgan-va-bugun kelmagan
  // bolalar — bazada ikkala ma'lumot ham bor, faqat shu yerda bog'lanadi.
  const chronicAbsencesQuery = useQuery({
    queryKey: ["chronic-absences", slug, branchId],
    queryFn: () => api.get<ChronicAbsenceFlag[]>(`/app/attendance/chronic-absences?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const chronicAbsenceByChildId = new Map((chronicAbsencesQuery.data ?? []).map((f) => [f.childId, f]));

  // Kelishni belgilash: sahifa ochilganda hamma bola "Keldi" deb ko'rsatiladi
  // (hali saqlanmagan) — ko'pchilik kun sayin kelgani uchun shunday tezroq.
  // Faqat kelmagan/kasal kabi istisnolarni o'zgartirib, oxirida "Saqlash"
  // bosiladi — shunda hammasi birdan yuboriladi.
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  // Faqat filial+sana haqiqatan almashganda tozalanadi — aks holda oyna fon
  // rejimida qayta ochilganda (masalan brauzer qaytadan fokuslanganda)
  // so'rov qayta yuklanadi va hali saqlanmagan belgilashlarni o'chirib
  // yuborishi mumkin edi.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!attendanceQuery.data || attendanceQuery.data.date !== date) return;
    const key = `${branchId}_${date}`;
    if (initializedForRef.current === key) return;
    initializedForRef.current = key;
    setLocalStatuses(
      Object.fromEntries(attendanceQuery.data.children.map((c) => [c.childId, c.status ?? "PRESENT"])),
    );
    setLocalNotes(Object.fromEntries(attendanceQuery.data.children.map((c) => [c.childId, c.note ?? ""])));
  }, [attendanceQuery.data, date, branchId]);
  const statusFor = (childId: string) => localStatuses[childId] ?? "PRESENT";
  const noteFor = (childId: string) => localNotes[childId] ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceQuery.data) return;
      await Promise.all(
        attendanceQuery.data.children.map((child) =>
          api.post("/app/attendance", {
            childId: child.childId,
            date,
            status: statusFor(child.childId),
            note: noteFor(child.childId),
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summary", slug, branchId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
  });

  // Sana yoki filial almashtirilganda oldingi urinishning "Saqlandi"/xatolik
  // xabari yangi kunga osilib qolmasin.
  useEffect(() => {
    saveMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  // Ota-ona sabab qoldirmagan bo'lsa — tarbiyachi shu tugma bilan filial
  // administratoriga xabar beradi (Bildirishnomalar jurnaliga yoziladi).
  const requestContactMutation = useMutation({
    mutationFn: (childId: string) => api.post("/app/attendance/request-contact", { childId, date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", slug, branchId, date] });
    },
  });

  const absentChildren = attendanceQuery.data?.children.filter((c) => c.status === "ABSENT") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Kunlik hisobot — Davomat")}</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">{tr("Bolalarning kunlik qatnashuvini belgilang")}</p>
        </div>
        {/* Mobilda "Eksport" yuqori panelda (uch chiziq qatorida), kompyuterda avvalgidek o'ngda */}
        <TopbarAction>
          <Button variant="outline" loading={exporting} disabled={!date || !branchId} onClick={handleExport}>
            {tr("Eksport (CSV)")}
          </Button>
        </TopbarAction>
        <div className="hidden md:block">
          <Button variant="outline" loading={exporting} disabled={!date || !branchId} onClick={handleExport}>
            {tr("Eksport (CSV)")}
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        {!forcedBranchId && branches.length > 1 && (
          <Select label={tr("Filial")} value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {tr(branch.name)}
              </option>
            ))}
          </Select>
        )}
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{tr("Sana")}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">
            {tr("Eksport oralig'i (ixtiyoriy)")}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={exportFrom}
              max={exportTo || undefined}
              onChange={(e) => setExportFrom(e.target.value)}
              aria-label={tr("Eksport — dan")}
              className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2 text-[13px] sm:px-3.5 sm:text-[15px] sm:flex-none text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
            />
            <span className="text-[13px] text-[var(--color-text-muted)]">—</span>
            <input
              type="date"
              value={exportTo}
              min={exportFrom || undefined}
              onChange={(e) => setExportTo(e.target.value)}
              aria-label={tr("Eksport — gacha")}
              className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2 text-[13px] sm:px-3.5 sm:text-[15px] sm:flex-none text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
            />
          </div>
        </div>
      </Card>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {tr(exportError)}
        </div>
      )}

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {branchId && date && <TodayRemindersCard slug={slug} branchId={branchId} today={date} />}

      {!date ? (
        <LoadingState />
      ) : !branchId ? (
        <EmptyState title={tr("Filial mavjud emas")} />
      ) : attendanceQuery.isLoading ? (
        <LoadingState />
      ) : attendanceQuery.isError ? (
        <ErrorState message={tr((attendanceQuery.error as Error).message)} />
      ) : !attendanceQuery.data || attendanceQuery.data.children.length === 0 ? (
        <EmptyState title={tr("Bu filialda faol bola yo'q")} />
      ) : (
        <>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "all" ? "primary" : "tertiary"} onClick={() => setTab("all")}>
              {tr("Barchasi")}
            </Button>
            <Button size="sm" variant={tab === "absent" ? "primary" : "tertiary"} onClick={() => setTab("absent")}>
              {tr("Kelmaganlar")}{absentChildren.length > 0 ? ` (${absentChildren.length})` : ""}
            </Button>
          </div>

          {tab === "absent" ? (
            <Card className="overflow-hidden">
              {absentChildren.length === 0 ? (
                <EmptyState title={tr("Bugun hammasi keldi")} description={tr("Kelmagan bola yo'q")} />
              ) : (
                <ul className="divide-y divide-[var(--color-separator)]">
                  {absentChildren.map((child) => (
                    <li key={child.childId} className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)]">{tr(child.fullName)}</p>
                        {child.groupName && (
                          <p className="text-xs text-[var(--color-text-muted)]">{tr(child.groupName)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {child.parentReason ? (
                          <div className="max-w-xs text-right">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                              {tr("Ota-ona sababi")}
                            </p>
                            <p className="text-sm text-[var(--color-text)]">{tr(child.parentReason)}</p>
                          </div>
                        ) : child.contactRequestedAt ? (
                          <Badge tone="warning">{tr("Aloqaga chiqish so'raldi")}</Badge>
                        ) : canWrite ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={
                              requestContactMutation.isPending &&
                              requestContactMutation.variables === child.childId
                            }
                            onClick={() => requestContactMutation.mutate(child.childId)}
                          >
                            {tr("Aloqaga chiqish")}
                          </Button>
                        ) : (
                          <Badge tone="neutral">{tr("Sabab yo'q")}</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--color-separator)]">
                {attendanceQuery.data.children.map((child) => (
                  <li key={child.childId} className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-[var(--color-text)]">{tr(child.fullName)}</p>
                        {(() => {
                          const flag = chronicAbsenceByChildId.get(child.childId);
                          if (!flag) return null;
                          return (
                            <>
                              {flag.consecutiveAbsentDays >= 3 && (
                                <Badge tone="danger">{tr(flag.consecutiveAbsentDays)} {tr("kun ketma-ket kelmadi")}</Badge>
                              )}
                              {flag.overdueAndAbsentToday && <Badge tone="danger">{tr("To'lov muddati o'tgan")}</Badge>}
                            </>
                          );
                        })()}
                      </div>
                      {/* Bir necha guruhli tarbiyachi kimni belgilayotganini bilsin */}
                      {child.groupName && (
                        <p className="text-xs text-[var(--color-text-muted)]">{tr(child.groupName)}</p>
                      )}
                      {/* Yuz tanish terminali (Face ID) qayd etgan vaqt */}
                      {child.checkInTime && (
                        <p className="text-xs font-medium text-[var(--color-success)]">
                          {tr("Face ID:")}{" "}{tr(child.checkInTime)} {tr("da keldi")}{child.checkOutTime ? ` · ${child.checkOutTime} da ketdi` : ""}
                        </p>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          className="mt-0.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                          onClick={() => setNoteChild({ id: child.childId, name: child.fullName })}
                        >
                          {tr("Xabar / eslatma")}
                        </button>
                      )}
                    </div>
                    {canWrite ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {statusFor(child.childId) !== "PRESENT" && (
                          <input
                            type="text"
                            value={noteFor(child.childId)}
                            onChange={(e) => setLocalNotes((s) => ({ ...s, [child.childId]: e.target.value }))}
                            placeholder={tr("Izoh (ixtiyoriy)")}
                            className="h-9 w-40 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          />
                        )}
                        <StatusSegmented
                          value={statusFor(child.childId)}
                          onChange={(status) => setLocalStatuses((s) => ({ ...s, [child.childId]: status }))}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          tone={
                            child.status === "PRESENT"
                              ? "success"
                              : child.status === "ABSENT"
                                ? "danger"
                                : child.status === "LATE" || child.status === "SICK"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {child.status ? CHILD_ATTENDANCE_STATUS_LABEL[child.status] : "Belgilanmagan"}
                        </Badge>
                        {child.note && <p className="text-xs text-[var(--color-text-muted)]">{tr(child.note)}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {canWrite && (
                <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 sm:px-6">
                  {saveMutation.isError && (
                    <span className="text-[13px] text-[var(--color-danger)]">{tr("Saqlashda xatolik yuz berdi")}</span>
                  )}
                  {saveMutation.isSuccess && !saveMutation.isPending && (
                    <span className="text-[13px] text-[var(--color-success)]">{tr("Saqlandi")}</span>
                  )}
                  <Button className="ml-auto" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                    {tr("Saqlash")}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{tr("So'nggi 14 kunlik statistika")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {!branchId || summaryQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : summaryQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={tr((summaryQuery.error as Error).message)} />
            </div>
          ) : !summaryQuery.data || summaryQuery.data.totalChildren === 0 ? (
            <EmptyState title={tr("Bu filialda faol bola yo'q")} />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>{tr("Sana")}</Th>
                  <Th numeric>{tr("Keldi")}</Th>
                  <Th numeric>{tr("Kelmadi")}</Th>
                  <Th numeric>{tr("Belgilanmagan")}</Th>
                </tr>
              </THead>
              <TBody>
                {summaryQuery.data.days.map((day) => (
                  <Tr key={day.date}>
                    <Td className="font-medium tabular-nums">{tr(day.date)}</Td>
                    <Td numeric className="text-[var(--color-success)]">{tr(day.present)}</Td>
                    <Td numeric className="text-[var(--color-danger)]">{tr(day.absent)}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{tr(day.unmarked)}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>
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
    </div>
  );
}
