import type { LessonSchedule, Weekday } from "@/lib/types";

export const WEEKDAY_ORDER: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: "Dushanba",
  TUESDAY: "Seshanba",
  WEDNESDAY: "Chorshanba",
  THURSDAY: "Payshanba",
  FRIDAY: "Juma",
  SATURDAY: "Shanba",
  SUNDAY: "Yakshanba",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  MONDAY: "Du",
  TUESDAY: "Se",
  WEDNESDAY: "Ch",
  THURSDAY: "Pa",
  FRIDAY: "Ju",
  SATURDAY: "Sh",
  SUNDAY: "Ya",
};

export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Bugungi hafta kuni (Toshkent vaqti) */
export function todayWeekday(): Weekday {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", weekday: "long" }).format(new Date()).toUpperCase();
  return (WEEKDAY_ORDER.includes(day as Weekday) ? day : "MONDAY") as Weekday;
}

export type ClashKind = "ROOM" | "TEACHER" | "GROUP";
export interface Clash {
  kind: ClashKind;
  /** To'qnashgan boshqa darsning guruhi */
  groupName: string;
}

/** To'qnashuv sababi — `tr("Xona band: {0}", nom)` ko'rinishida chiqariladi */
export const CLASH_LABEL: Record<ClashKind, string> = {
  ROOM: "Xona band: {0}",
  TEACHER: "O'qituvchi band: {0}",
  GROUP: "Guruhda boshqa dars: {0}",
};

/**
 * Jadvaldagi mavjud to'qnashuvlar (masalan «Baribir saqlash» bilan
 * qo'yilganlar): bir kunda vaqti kesishgan va xonasi, o'qituvchisi yoki
 * guruhi bir xil darslar. Server bilan bir xil qoida (yarim ochiq oraliq).
 * Natija — dars id → nima bilan to'qnashgani.
 */
export function scheduleClashes(rows: LessonSchedule[]): Map<string, Clash[]> {
  const out = new Map<string, Clash[]>();
  const add = (id: string, clash: Clash) => {
    const list = out.get(id) ?? [];
    if (!list.some((c) => c.kind === clash.kind && c.groupName === clash.groupName)) list.push(clash);
    out.set(id, list);
  };
  for (let i = 0; i < rows.length; i += 1) {
    for (let k = i + 1; k < rows.length; k += 1) {
      const a = rows[i];
      const b = rows[k];
      if (a.weekday !== b.weekday) continue;
      if (!(timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime))) continue;
      const pairs: [ClashKind, boolean][] = [
        ["ROOM", !!a.roomId && a.roomId === b.roomId],
        ["TEACHER", a.employeeId === b.employeeId],
        ["GROUP", a.groupId === b.groupId],
      ];
      for (const [kind, hit] of pairs) {
        if (!hit) continue;
        add(a.id, { kind, groupName: b.group.name });
        add(b.id, { kind, groupName: a.group.name });
      }
    }
  }
  return out;
}
