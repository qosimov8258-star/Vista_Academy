import type { StaffAttendanceSummary } from "@/lib/types";

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
