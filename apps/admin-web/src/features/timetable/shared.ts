/**
 * Haftalik jadval — admin bo'limi va ota-ona kabineti uchun umumiy turlar.
 * Server: `/app/diary/timetables`, `/app/diary/groups/:id/timetable`,
 * ota-ona — `/app/parent/children/:id/timetable`. Jadval aslida kundalik
 * kun tartibi (`DiaryRoutineItem`) — jadval ko'rinishida.
 */

export interface TimetableRow {
  startTime: string;
  /** Bo'sh satr — tugash vaqti ko'rsatilmagan */
  endTime: string;
  /** 7 ta katak: Du … Ya */
  cells: string[];
}

export interface GroupTimetable {
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  note: string;
  rows: TimetableRow[];
}

export const DAY_COUNT = 7;
/** Ustunlar tartibi serverdagi bilan bir xil: Du … Ya */
export const DAY_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
export const DAY_LONG = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

/** Bugungi kun indeksi (0 = Du … 6 = Ya) */
export function todayIndex(date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

/** Yakshanba ustuni faqat unda mashg'ulot bo'lsa ko'rsatiladi */
export function visibleDays(rows: TimetableRow[]): number[] {
  const sunday = rows.some((row) => row.cells[6]?.trim());
  return sunday ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5];
}

export function timeLabel(row: Pick<TimetableRow, "startTime" | "endTime">): string {
  return row.endTime ? `${row.startTime}–${row.endTime}` : row.startTime;
}

export function sortRows(rows: TimetableRow[]): TimetableRow[] {
  return [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

export function emptyCells(): string[] {
  return Array.from({ length: DAY_COUNT }, () => "");
}

/** "09:30" → daqiqalar */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Hozir shu qator vaqtidami (tugash vaqti bo'lmasa — keyingi qatorgacha) */
export function isNowRow(rows: TimetableRow[], index: number, nowMinutes: number): boolean {
  const row = rows[index];
  const start = minutesOf(row.startTime);
  const end = row.endTime ? minutesOf(row.endTime) : rows[index + 1] ? minutesOf(rows[index + 1].startTime) : start + 30;
  return nowMinutes >= start && nowMinutes < end;
}

/**
 * Bo'sh jadval uchun namuna vaqtlar — Vista jadvalidagi kabi 09:00–17:00,
 * 30 daqiqalik qatorlar (uyqu 12:30–14:00). Mashg'ulot nomlari bo'sh.
 */
export const SAMPLE_SLOTS: [string, string][] = [
  ["09:00", "09:30"],
  ["09:30", "10:00"],
  ["10:00", "10:30"],
  ["10:30", "11:00"],
  ["11:00", "11:30"],
  ["11:30", "12:00"],
  ["12:00", "12:30"],
  ["12:30", "14:00"],
  ["14:00", "14:30"],
  ["14:30", "15:00"],
  ["15:00", "15:30"],
  ["15:30", "16:00"],
  ["16:00", "16:30"],
  ["16:30", "17:00"],
];
