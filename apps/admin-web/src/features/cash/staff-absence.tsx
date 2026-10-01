"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/states";
import type { StaffAttendanceDay, StaffAttendanceStatus, StaffAttendanceSummary } from "@/lib/types";
import { todayTashkent } from "./shared";
import { useTr } from "@/i18n/tr";

const NOT_HERE: Partial<Record<StaffAttendanceStatus, { label: string; tone: "danger" | "warning" | "neutral" }>> = {
  ABSENT: { label: "Kelmadi", tone: "danger" },
  SICK: { label: "Kasal", tone: "warning" },
  ON_LEAVE: { label: "Ta'til", tone: "neutral" },
};

/** Bugun kelmagan, kasal yoki ta'tildagi xodimlar — kassirning bosh sahifasida qisqacha. */
export function StaffAbsenceToday({ slug, branchId }: { slug: string; branchId: string }) {
  const tr = useTr();
  const today = todayTashkent();
  const query = useQuery({
    queryKey: ["staff-attendance", slug, branchId, today],
    queryFn: () => api.get<StaffAttendanceDay>(`/app/staff-attendance?branchId=${branchId}&date=${today}`),
    refetchInterval: 60_000,
  });

  if (query.isLoading) return <LoadingState rows={1} />;
  const rows = (query.data?.employees ?? []).filter((e) => e.status && NOT_HERE[e.status]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>{tr("Bugun kelmagan xodimlar")}</CardTitle>
        <Link href={`/${slug}/staff-absences`} className="text-[13px] font-medium text-[var(--color-primary)] hover:underline">
          {tr("Kelmagan kunlar")}
        </Link>
      </CardHeader>
      <CardBody className="space-y-2 text-[14px]">
        {rows.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">{tr("Bugun kelmagan xodim yo'q")}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {rows.map((e) => (
              <li key={e.employeeId} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{tr(e.fullName)}</span>
                  <span className="ml-2 text-[12.5px] text-[var(--color-text-muted)]">{tr(e.position)}</span>
                </span>
                <Badge tone={NOT_HERE[e.status!]!.tone}>{tr(NOT_HERE[e.status!]!.label)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** "Kelmadi 2 · Kasal 1 · Ta'til 1" — bir xodimning oy bo'yicha qisqa izohi (bo'lmasa null). */
export function absenceNote(
  row: StaffAttendanceSummary["employees"][number] | undefined,
  tr: (text: string, ...args: unknown[]) => string,
): string | null {
  if (!row) return null;
  const parts = [
    row.absent > 0 ? tr("kelmadi {0} kun", row.absent) : null,
    row.sick > 0 ? tr("kasal {0} kun", row.sick) : null,
    row.onLeave > 0 ? tr("ta'til {0} kun", row.onLeave) : null,
    row.late > 0 ? tr("kech qoldi {0} marta", row.late) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
