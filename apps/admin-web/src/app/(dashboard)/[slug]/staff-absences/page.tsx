"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Employee, StaffAttendanceStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { currentMonth, todayTashkent } from "@/features/cash/shared";

interface Absence {
  employeeId: string;
  fullName: string;
  position: string;
  date: string;
  status: StaffAttendanceStatus;
  note: string | null;
}

const KINDS = {
  ABSENT: { label: "Kelmadi", tone: "danger" },
  SICK: { label: "Kasal", tone: "warning" },
  ON_LEAVE: { label: "Ta'til", tone: "neutral" },
} as const;
type Kind = keyof typeof KINDS;

/**
 * Kassir to'liq kunlik davomat qilmaydi — faqat kim qaysi kuni kelmaganini yozib qo'yadi,
 * shu asosda ish haqi hisoblanadi. Adashib yozilgan kun "Bekor qilish" bilan qaytariladi.
 */
export default function StaffAbsencesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branchId ?? "";
  const [period, setPeriod] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<Kind>("ABSENT");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeriod((p) => p || currentMonth());
    setDate((d) => d || todayTashkent());
  }, []);

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, branchId],
    queryFn: () => api.get<Employee[]>("/app/employees"),
    enabled: !!branchId,
  });
  const absencesQuery = useQuery({
    queryKey: ["staff-absences", slug, branchId, period],
    queryFn: () => api.get<{ absences: Absence[] }>(`/app/staff-attendance/absences?period=${period}&branchId=${branchId}`),
    enabled: !!period && !!branchId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-absences", slug] });
    queryClient.invalidateQueries({ queryKey: ["staff-attendance", slug] });
    queryClient.invalidateQueries({ queryKey: ["staff-attendance-summary", slug] });
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");

  const add = useMutation({
    mutationFn: () => api.post("/app/staff-attendance", { employeeId, date, status, note: note.trim() || undefined }),
    onSuccess: () => {
      setError(null);
      setNote("");
      refresh();
    },
    onError: fail,
  });
  // Bekor qilish: o'sha kunni "Keldi" ga qaytaradi — ro'yxatdan chiqib ketadi.
  const undo = useMutation({
    mutationFn: (a: Absence) => api.post("/app/staff-attendance", { employeeId: a.employeeId, date: a.date, status: "PRESENT" }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: fail,
  });

  const absences = absencesQuery.data?.absences ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Kelmagan kunlar</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Kim qaysi kuni kelmagan — ish haqi shundan hisoblanadi</p>
        </div>
        <div className="w-[170px]">
          <Input label="Oy" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Kelmagan kunni yozish</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-end gap-3">
          <Select label="Xodim" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="min-w-[220px]">
            <option value="" disabled>
              Tanlang
            </option>
            {(employeesQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} — {e.position}
              </option>
            ))}
          </Select>
          <Input label="Sana" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
          <Select label="Holat" value={status} onChange={(e) => setStatus(e.target.value as Kind)}>
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {KINDS[k].label}
              </option>
            ))}
          </Select>
          <Input label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} className="min-w-[200px] flex-1" />
          <Button loading={add.isPending} disabled={!employeeId || !date} onClick={() => { setError(null); add.mutate(); }}>
            Yozish
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shu oyda kelmaganlar</CardTitle>
        </CardHeader>
        <CardBody>
          {absencesQuery.isLoading ? (
            <LoadingState rows={3} />
          ) : absencesQuery.isError ? (
            <ErrorState message={(absencesQuery.error as Error).message} />
          ) : absences.length === 0 ? (
            <EmptyState title="Bu oyda kelmagan xodim yo'q" />
          ) : (
            <ul className="divide-y divide-[var(--color-border)] text-[14px]">
              {absences.map((a) => (
                <li key={`${a.employeeId}-${a.date}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <span className="font-medium">{a.fullName}</span>
                    <span className="ml-2 text-[12.5px] text-[var(--color-text-muted)]">{a.position}</span>
                    {a.note && <p className="text-[12.5px] text-[var(--color-text-muted)]">{a.note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-[var(--color-text-muted)]">{formatDate(a.date)}</span>
                    <Badge tone={KINDS[a.status as Kind]?.tone ?? "neutral"}>{KINDS[a.status as Kind]?.label ?? a.status}</Badge>
                    <Button size="sm" variant="outline" loading={undo.isPending && undo.variables?.date === a.date && undo.variables?.employeeId === a.employeeId} onClick={() => { setError(null); undo.mutate(a); }}>
                      Bekor qilish
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
