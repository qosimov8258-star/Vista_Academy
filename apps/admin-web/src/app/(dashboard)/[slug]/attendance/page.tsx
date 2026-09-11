"use client";

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
import { canWriteTeaching } from "@/lib/permissions";

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

export default function AttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
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
  const canWrite = canWriteTeaching(user?.role);

  useEffect(() => {
    setDate((current) => current || todayDateString());
  }, []);

  const handleExport = async () => {
    // Oraliqning faqat bittasi to'ldirilgan bo'lsa — jim tarzda bitta
    // kunlik eksportga o'tish o'rniga aniq xato ko'rsatamiz, aks holda
    // foydalanuvchi oraliqni so'raganini bilmay qoladi.
    if ((exportFrom && !exportTo) || (!exportFrom && exportTo)) {
      setExportError("Sana oralig'i uchun ham \"dan\", ham \"gacha\" ni to'ldiring");
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
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Kunlik hisobot — Davomat</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">Bolalarning kunlik qatnashuvini belgilang</p>
        </div>
        <Button variant="outline" loading={exporting} disabled={!date || !branchId} onClick={handleExport}>
          Eksport (CSV)
        </Button>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        {!forcedBranchId && (
          <Select label="Filial" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        )}
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">
            Eksport oralig&apos;i (ixtiyoriy)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={exportFrom}
              max={exportTo || undefined}
              onChange={(e) => setExportFrom(e.target.value)}
              aria-label="Eksport — dan"
              className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
            />
            <span className="text-[13px] text-[var(--color-text-muted)]">—</span>
            <input
              type="date"
              value={exportTo}
              min={exportFrom || undefined}
              onChange={(e) => setExportTo(e.target.value)}
              aria-label="Eksport — gacha"
              className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
            />
          </div>
        </div>
      </Card>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {exportError}
        </div>
      )}

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {!date ? (
        <LoadingState />
      ) : !branchId ? (
        <EmptyState title="Filial mavjud emas" />
      ) : attendanceQuery.isLoading ? (
        <LoadingState />
      ) : attendanceQuery.isError ? (
        <ErrorState message={(attendanceQuery.error as Error).message} />
      ) : !attendanceQuery.data || attendanceQuery.data.children.length === 0 ? (
        <EmptyState title="Bu filialda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {attendanceQuery.data.children.map((child) => (
              <li key={child.childId} className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-[var(--color-text)]">{child.fullName}</p>
                    {(() => {
                      const flag = chronicAbsenceByChildId.get(child.childId);
                      if (!flag) return null;
                      return (
                        <>
                          {flag.consecutiveAbsentDays >= 3 && (
                            <Badge tone="danger">{flag.consecutiveAbsentDays} kun ketma-ket kelmadi</Badge>
                          )}
                          {flag.overdueAndAbsentToday && <Badge tone="danger">To&apos;lov muddati o&apos;tgan</Badge>}
                        </>
                      );
                    })()}
                  </div>
                  {/* Bir necha guruhli tarbiyachi kimni belgilayotganini bilsin */}
                  {child.groupName && (
                    <p className="text-xs text-[var(--color-text-muted)]">{child.groupName}</p>
                  )}
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {statusFor(child.childId) !== "PRESENT" && (
                      <input
                        type="text"
                        value={noteFor(child.childId)}
                        onChange={(e) => setLocalNotes((s) => ({ ...s, [child.childId]: e.target.value }))}
                        placeholder="Izoh (ixtiyoriy)"
                        className="h-9 w-40 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    )}
                    <Button
                      size="sm"
                      variant={statusFor(child.childId) === "PRESENT" ? "primary" : "tertiary"}
                      className={clsx(statusFor(child.childId) === "PRESENT" && "bg-[var(--color-success)] hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [child.childId]: "PRESENT" }))}
                    >
                      Keldi
                    </Button>
                    <Button
                      size="sm"
                      variant={statusFor(child.childId) === "ABSENT" ? "danger" : "tertiary"}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [child.childId]: "ABSENT" }))}
                    >
                      Kelmadi
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      className={clsx(statusFor(child.childId) === "LATE" && "bg-[var(--color-warning)] text-white hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [child.childId]: "LATE" }))}
                    >
                      Kech qoldi
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      className={clsx(statusFor(child.childId) === "SICK" && "bg-[var(--color-warning)] text-white hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [child.childId]: "SICK" }))}
                    >
                      Kasal
                    </Button>
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
                    {child.note && <p className="text-xs text-[var(--color-text-muted)]">{child.note}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canWrite && (
            <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 sm:px-6">
              {saveMutation.isError && (
                <span className="text-[13px] text-[var(--color-danger)]">Saqlashda xatolik yuz berdi</span>
              )}
              {saveMutation.isSuccess && !saveMutation.isPending && (
                <span className="text-[13px] text-[var(--color-success)]">Saqlandi</span>
              )}
              <Button className="ml-auto" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Saqlash
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>So&apos;nggi 14 kunlik statistika</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {!branchId || summaryQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : summaryQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(summaryQuery.error as Error).message} />
            </div>
          ) : !summaryQuery.data || summaryQuery.data.totalChildren === 0 ? (
            <EmptyState title="Bu filialda faol bola yo'q" />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Sana</Th>
                  <Th numeric>Keldi</Th>
                  <Th numeric>Kelmadi</Th>
                  <Th numeric>Belgilanmagan</Th>
                </tr>
              </THead>
              <TBody>
                {summaryQuery.data.days.map((day) => (
                  <Tr key={day.date}>
                    <Td className="font-medium tabular-nums">{day.date}</Td>
                    <Td numeric className="text-[var(--color-success)]">{day.present}</Td>
                    <Td numeric className="text-[var(--color-danger)]">{day.absent}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{day.unmarked}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
