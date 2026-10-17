import type { Weekday } from "@prisma/client";

/**
 * Dars jadvali to'qnashuvlari — bazaga tegmaydigan sof funksiya (testlanadi).
 *
 * Bir hafta kunida vaqt oraliqlari kesishsa (yarim ochiq: 09:00–09:45 va
 * 09:45–10:30 to'qnashmaydi) va quyidagilardan biri bir xil bo'lsa:
 *  - ROOM    — xona (ikkalasida ham xona tanlangan bo'lsa);
 *  - TEACHER — o'qituvchi (qaysi guruh bo'lishidan qat'i nazar);
 *  - GROUP   — guruh (bir guruhda bir vaqtda ikkita dars).
 * CAPACITY — guruhdagi bolalar xona sig'imidan ko'p: faqat ogohlantirish.
 * Saqlashni to'xtatadiganlari — `blocking()`; admin «Baribir saqlash» bilan
 * o'tkazib yuborishi mumkin (`force`).
 */
export type ConflictKind = "ROOM" | "TEACHER" | "GROUP" | "CAPACITY";

export interface ScheduleConflict {
  kind: ConflictKind;
  weekday: Weekday | null;
  message: string;
  /** To'qnashgan mavjud dars (CAPACITY da yo'q) */
  scheduleId?: string;
  startTime?: string;
  endTime?: string;
}

export interface PlannedSlot {
  groupId: string;
  employeeId: string;
  roomId: string | null;
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
}

export interface ExistingSlot {
  id: string;
  groupId: string;
  employeeId: string;
  roomId: string | null;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  groupName: string;
  employeeName: string;
  roomName: string | null;
}

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: "dushanba",
  TUESDAY: "seshanba",
  WEDNESDAY: "chorshanba",
  THURSDAY: "payshanba",
  FRIDAY: "juma",
  SATURDAY: "shanba",
  SUNDAY: "yakshanba",
};

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Yarim ochiq oraliqlar: bir dars tugagan daqiqada keyingisi boshlanishi mumkin. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function findScheduleConflicts(
  planned: PlannedSlot,
  existing: ExistingSlot[],
  capacity?: { roomName: string; roomCapacity: number | null; groupName: string; childCount: number },
): ScheduleConflict[] {
  const start = timeToMinutes(planned.startTime);
  const end = timeToMinutes(planned.endTime);
  const conflicts: ScheduleConflict[] = [];

  for (const weekday of planned.weekdays) {
    const day = WEEKDAY_LABEL[weekday];
    for (const row of existing) {
      if (row.weekday !== weekday) continue;
      if (!overlaps(start, end, timeToMinutes(row.startTime), timeToMinutes(row.endTime))) continue;
      const at = { weekday, scheduleId: row.id, startTime: row.startTime, endTime: row.endTime };
      const time = `${row.startTime}–${row.endTime}`;
      if (planned.roomId && row.roomId === planned.roomId) {
        conflicts.push({ kind: "ROOM", ...at, message: `«${row.roomName ?? "Xona"}» ${day} kuni ${time} da band — «${row.groupName}» guruhi darsi` });
      }
      if (row.employeeId === planned.employeeId) {
        conflicts.push({ kind: "TEACHER", ...at, message: `${row.employeeName} ${day} kuni ${time} da band — «${row.groupName}» guruhida` });
      }
      if (row.groupId === planned.groupId) {
        conflicts.push({ kind: "GROUP", ...at, message: `«${row.groupName}» guruhida ${day} kuni ${time} da boshqa dars bor` });
      }
    }
  }

  if (capacity && capacity.roomCapacity !== null && capacity.childCount > capacity.roomCapacity) {
    conflicts.push({
      kind: "CAPACITY",
      weekday: null,
      message: `«${capacity.groupName}» guruhida ${capacity.childCount} bola, «${capacity.roomName}» xonasi ${capacity.roomCapacity} kishilik`,
    });
  }
  return conflicts;
}

/** Saqlashni to'xtatadigan to'qnashuvlar (sig'im — faqat ogohlantirish). */
export function blocking(conflicts: ScheduleConflict[]): ScheduleConflict[] {
  return conflicts.filter((conflict) => conflict.kind !== "CAPACITY");
}
