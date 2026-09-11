"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization, StaffAttendanceDay, StaffAttendanceStatus, StaffAttendanceSummary } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardHeader, CardBody, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import clsx from "clsx";
import { canWriteOperational } from "@/lib/permissions";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

function currentPeriodString(): string {
  return todayDateString().slice(0, 7);
}

const STATUS_LABEL: Record<StaffAttendanceStatus, string> = {
  PRESENT: "Keldi",
  ABSENT: "Kelmadi",
  LATE: "Kech qoldi",
  SICK: "Kasal",
  ON_LEAVE: "Ta'til",
};

export default function StaffAttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date input.
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState("");
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);

  useEffect(() => {
    setDate((current) => current || todayDateString());
    setPeriod((current) => current || currentPeriodString());
  }, []);

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
    queryKey: ["staff-attendance", slug, branchId, date],
    queryFn: () => api.get<StaffAttendanceDay>(`/app/staff-attendance?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });

  const summaryQuery = useQuery({
    queryKey: ["staff-attendance-summary", slug, branchId, period],
    queryFn: () => api.get<StaffAttendanceSummary>(`/app/staff-attendance/summary?branchId=${branchId}&period=${period}`),
    enabled: !!branchId && !!period,
  });

  const [times, setTimes] = useState<Record<string, { checkInTime: string; checkOutTime: string }>>({});
  const timeFor = (employeeId: string, employee: { checkInTime: string | null; checkOutTime: string | null }) =>
    times[employeeId] ?? { checkInTime: employee.checkInTime ?? "", checkOutTime: employee.checkOutTime ?? "" };

  // Kelishni belgilash: sahifa ochilganda hamma "Keldi" deb ko'rsatiladi (hali
  // saqlanmagan) — ko'pchilik kun sayin kelgani uchun shunday tezroq. Faqat
  // kelmagan/kech qolgan kabi istisnolarni o'zgartirib, oxirida "Saqlash"
  // bosiladi — shunda hammasi birdan yuboriladi.
  //
  // `attendanceQuery.data.date` bilan tekshiramiz (shunchaki obyekt
  // referensiyasi emas) — aks holda sana oldinga-orqaga almashtirilsa (masalan
  // A -> B -> A, keshdan darhol qaytadi) eski sananing belgilashlari yangi
  // sanaga "sizib o'tib" saqlanib ketishi mumkin edi.
  const [localStatuses, setLocalStatuses] = useState<Record<string, StaffAttendanceStatus>>({});
  // Faqat filial+sana haqiqatan almashganda tozalanadi — aks holda so'rov fon
  // rejimida qayta yuklanganda (masalan oyna qaytadan fokuslanganda) hali
  // saqlanmagan belgilashlar jimgina o'chirib yuborilishi mumkin edi.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!attendanceQuery.data || attendanceQuery.data.date !== date) return;
    const key = `${branchId}_${date}`;
    if (initializedForRef.current === key) return;
    initializedForRef.current = key;
    setLocalStatuses(
      Object.fromEntries(attendanceQuery.data.employees.map((e) => [e.employeeId, e.status ?? "PRESENT"])),
    );
    // Vaqt maydonlari ham shu sanaga xos — sana almashganda avvalgi
    // kiritilgan (hali saqlanmagan) vaqtlar olib tashlanadi.
    setTimes({});
  }, [attendanceQuery.data, date, branchId]);
  const statusFor = (employeeId: string) => localStatuses[employeeId] ?? "PRESENT";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceQuery.data) return;
      await Promise.all(
        attendanceQuery.data.employees.map((employee) => {
          const t = timeFor(employee.employeeId, employee);
          return api.post("/app/staff-attendance", {
            employeeId: employee.employeeId,
            date,
            status: statusFor(employee.employeeId),
            // Bo'sh satr backend validatsiyasidan o'tmaydi ("" - to'g'ri
            // HH:MM emas) — shuning uchun bo'sh bo'lsa umuman yubormaymiz.
            checkInTime: t.checkInTime || undefined,
            checkOutTime: t.checkOutTime || undefined,
          });
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["staff-attendance-summary", slug, branchId] });
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
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Xodimlar davomati</h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">Tarbiyachi va boshqa xodimlarning kunlik davomati</p>
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
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {!date ? (
        <LoadingState />
      ) : !branchId ? (
        <EmptyState title="Filial mavjud emas" />
      ) : attendanceQuery.isLoading ? (
        <LoadingState />
      ) : attendanceQuery.isError ? (
        <ErrorState message={(attendanceQuery.error as Error).message} />
      ) : !attendanceQuery.data || attendanceQuery.data.employees.length === 0 ? (
        <EmptyState title="Bu filialda faol xodim yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {attendanceQuery.data.employees.map((employee) => (
              <li key={employee.employeeId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{employee.fullName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{employee.position}</p>
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <input
                      type="time"
                      aria-label="Kelgan vaqti"
                      value={timeFor(employee.employeeId, employee).checkInTime}
                      onChange={(e) =>
                        setTimes((t) => ({
                          ...t,
                          [employee.employeeId]: { ...timeFor(employee.employeeId, employee), checkInTime: e.target.value },
                        }))
                      }
                      className="h-8 w-[90px] rounded-[var(--radius-sm)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                    <input
                      type="time"
                      aria-label="Ketgan vaqti"
                      value={timeFor(employee.employeeId, employee).checkOutTime}
                      onChange={(e) =>
                        setTimes((t) => ({
                          ...t,
                          [employee.employeeId]: { ...timeFor(employee.employeeId, employee), checkOutTime: e.target.value },
                        }))
                      }
                      className="h-8 w-[90px] rounded-[var(--radius-sm)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                    <Button
                      size="sm"
                      variant={statusFor(employee.employeeId) === "PRESENT" ? "primary" : "tertiary"}
                      className={clsx(statusFor(employee.employeeId) === "PRESENT" && "bg-[var(--color-success)] hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [employee.employeeId]: "PRESENT" }))}
                    >
                      Keldi
                    </Button>
                    <Button
                      size="sm"
                      variant={statusFor(employee.employeeId) === "ABSENT" ? "danger" : "tertiary"}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [employee.employeeId]: "ABSENT" }))}
                    >
                      Kelmadi
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      className={clsx(statusFor(employee.employeeId) === "LATE" && "bg-[var(--color-warning)] text-white hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [employee.employeeId]: "LATE" }))}
                    >
                      Kech qoldi
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      className={clsx(statusFor(employee.employeeId) === "SICK" && "bg-[var(--color-warning)] text-white hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [employee.employeeId]: "SICK" }))}
                    >
                      Kasal
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      className={clsx(statusFor(employee.employeeId) === "ON_LEAVE" && "bg-[var(--color-text-muted)] text-white hover:opacity-90")}
                      onClick={() => setLocalStatuses((s) => ({ ...s, [employee.employeeId]: "ON_LEAVE" }))}
                    >
                      Ta&apos;til
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {(employee.checkInTime || employee.checkOutTime) && (
                      <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                        {employee.checkInTime ?? "—"}–{employee.checkOutTime ?? "—"}
                      </span>
                    )}
                    <Badge
                      tone={
                        employee.status === "PRESENT"
                          ? "success"
                          : employee.status === "ABSENT"
                            ? "danger"
                            : employee.status === "LATE" || employee.status === "SICK"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {employee.status ? STATUS_LABEL[employee.status] : "Belgilanmagan"}
                    </Badge>
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
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Oylik jamlanma ({period})</CardTitle>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
        </CardHeader>
        <CardBody className="p-0">
          {!period || summaryQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : summaryQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(summaryQuery.error as Error).message} />
            </div>
          ) : !summaryQuery.data || summaryQuery.data.employees.length === 0 ? (
            <EmptyState title="Bu oy uchun ma'lumot yo'q" />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>Xodim</Th>
                  <Th numeric>Keldi</Th>
                  <Th numeric>Kelmadi</Th>
                  <Th numeric>Kech</Th>
                  <Th numeric>Kasal</Th>
                  <Th numeric>Ta&apos;til</Th>
                  <Th numeric>Foiz</Th>
                </tr>
              </THead>
              <TBody>
                {summaryQuery.data.employees.map((employee) => (
                  <Tr key={employee.employeeId}>
                    <Td className="font-medium">{employee.fullName}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{employee.present}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{employee.absent}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{employee.late}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{employee.sick}</Td>
                    <Td numeric className="text-[var(--color-text-muted)]">{employee.onLeave}</Td>
                    <Td numeric>
                      {employee.rate === null ? (
                        "—"
                      ) : (
                        <Badge tone={employee.rate >= 80 ? "success" : employee.rate >= 50 ? "warning" : "danger"}>
                          {employee.rate}%
                        </Badge>
                      )}
                    </Td>
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
