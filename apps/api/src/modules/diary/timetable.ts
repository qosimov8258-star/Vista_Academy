import { DiaryActivityKind, Weekday } from "@prisma/client";

/**
 * Haftalik jadval ↔ kundalik kun tartibi.
 *
 * Jadval (Vista PDF'idagi ko'rinish): qator — vaqt oralig'i, ustun — hafta
 * kuni, katak — mashg'ulot nomi. Bazada esa u `DiaryRoutineItem` bandlari:
 * har bir (vaqt, nom) juftligi bitta band, u qaysi kunlarda bo'lsa —
 * `weekdays`. Shu sabab jadval to'ldirilishi bilan ota-ona kundaligida
 * ham kunma-kun ko'rinadi va tarbiyachi uni "o'tdi" deb belgilay oladi.
 */

/** Jadval ustunlari tartibi: Du … Ya */
export const TIMETABLE_DAYS: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export const TIMETABLE_LIMITS = {
  rows: 40,
  /** Bitta guruhga (har kuni boshqa mashg'ulot bo'lsa bandlar ko'payadi) */
  items: 200,
  noteMaxLength: 500,
} as const;

export interface TimetableRow {
  startTime: string;
  /** Bo'sh satr — tugash vaqti ko'rsatilmagan */
  endTime: string;
  /** 7 ta katak: Du … Ya; bo'sh satr — o'sha kuni mashg'ulot yo'q */
  cells: string[];
}

export interface RoutineLike {
  id: string;
  startTime: string;
  endTime: string | null;
  title: string;
  kind: DiaryActivityKind;
  weekdays: Weekday[];
}

/** Bir vaqtda bir nechta band bo'lsa katakda " / " bilan qo'shiladi */
const CELL_JOIN = " / ";

export function gridFromItems(items: RoutineLike[]): TimetableRow[] {
  const rows = new Map<string, TimetableRow>();
  for (const item of items) {
    const key = `${item.startTime}|${item.endTime ?? ""}`;
    let row = rows.get(key);
    if (!row) {
      row = { startTime: item.startTime, endTime: item.endTime ?? "", cells: TIMETABLE_DAYS.map(() => "") };
      rows.set(key, row);
    }
    for (const day of item.weekdays) {
      const index = TIMETABLE_DAYS.indexOf(day);
      if (index < 0) continue;
      row.cells[index] = row.cells[index] ? `${row.cells[index]}${CELL_JOIN}${item.title}` : item.title;
    }
  }
  return [...rows.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

export interface PlannedItem {
  id?: string;
  startTime: string;
  endTime: string | null;
  title: string;
  kind: DiaryActivityKind;
  weekdays: Weekday[];
}

/**
 * Jadvalni bandlarga aylantiradi. Vaqti va nomi o'zgarmagan bandning `id`si
 * saqlanadi — tarbiyachining o'sha banddagi belgilari unga bog'liq qoladi.
 * Turi (ikonka) ham mavjud banddan olinadi, yangisi nomidan taxmin qilinadi.
 */
export function itemsFromGrid(rows: TimetableRow[], existing: RoutineLike[]): PlannedItem[] {
  const unused = new Map<string, RoutineLike[]>();
  const kindByTitle = new Map<string, DiaryActivityKind>();
  for (const item of existing) {
    const key = itemKey(item.startTime, item.endTime, item.title);
    unused.set(key, [...(unused.get(key) ?? []), item]);
    kindByTitle.set(normalizeTitle(item.title), item.kind);
  }

  const planned: PlannedItem[] = [];
  const sorted = [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
  for (const row of sorted) {
    // Bir qatorda bir xil nomli kunlar bitta bandga yig'iladi
    const byTitle = new Map<string, { title: string; weekdays: Weekday[] }>();
    row.cells.forEach((raw, index) => {
      const title = raw.trim().replace(/\s+/g, " ");
      if (!title) return;
      const key = normalizeTitle(title);
      const entry = byTitle.get(key) ?? { title, weekdays: [] };
      entry.weekdays.push(TIMETABLE_DAYS[index]);
      byTitle.set(key, entry);
    });
    const endTime = row.endTime || null;
    for (const { title, weekdays } of byTitle.values()) {
      const key = itemKey(row.startTime, endTime, title);
      const match = unused.get(key)?.shift();
      planned.push({
        id: match?.id,
        startTime: row.startTime,
        endTime,
        title,
        kind: match?.kind ?? kindByTitle.get(normalizeTitle(title)) ?? guessKind(title),
        weekdays,
      });
    }
  }
  return planned;
}

function itemKey(start: string, end: string | null, title: string) {
  return `${start}|${end ?? ""}|${normalizeTitle(title)}`;
}

function normalizeTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Nomidan mashg'ulot turini taxmin qiladi (kundalikdagi ikonka uchun).
 * O'zbekcha (lotin/kirill) va ruscha nomlar tanib olinadi.
 */
export function guessKind(title: string): DiaryActivityKind {
  const t = title.toLowerCase().replace(/[‘’`ʻʼ]/g, "'");
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("завтрак", "обед", "полдник", "ужин", "nonushta", "tushlik", "ovqat", "нонушта", "тушлик", "овқат", "peshin", "kechki")) return "MEAL";
  if (has("сон", "отдых", "uyqu", "dam olish", "уйқу")) return "SLEEP";
  if (has("зарядк", "гимнаст", "физкульт", "badantarbiya", "gimnastika", "jismoniy", "sport", "бадантарбия", "спорт")) return "EXERCISE";
  if (has("прогулк", "sayr", "сайр", "ochiq havo")) return "WALK";
  if (has("бассейн", "плаван", "suzish", "сузиш")) return "SWIM";
  if (has("рисован", "творч", "лепк", "аппликац", "кружок", "rasm", "ijod", "loy", "расм", "ижод", "to'garak")) return "CREATIVE";
  if (has("игр", "o'yin", "ўйин")) return "PLAY";
  if (has("приход", "прием", "приём", "kelish", "qabul", "келиш")) return "ARRIVAL";
  if (has("уход", "ketish", "кетиш", "uyga")) return "DEPARTURE";
  return "LESSON";
}
