import type { AttendanceStatus, Weekday } from "@/lib/types";

/**
 * Kundalik turlari — ota-ona kabineti ham, tarbiyachi paneli ham shu
 * shaklni oladi. Shartnoma: docs/kundalik-api.md (API: apps/api/src/modules/diary).
 */

export type DiaryActivityKind =
  | "ARRIVAL"
  | "LESSON"
  | "EXERCISE"
  | "MEAL"
  | "SLEEP"
  | "WALK"
  | "SWIM"
  | "PLAY"
  | "CREATIVE"
  | "DEPARTURE"
  | "OTHER";

export interface DiaryMedia {
  id: string;
  entryId: string | null;
  kind: "PHOTO" | "VIDEO";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  caption: string | null;
  hasPoster: boolean;
  createdAt: string;
  createdByName: string;
}

export interface DiaryItem {
  key: string;
  routineItemId: string | null;
  entryId: string | null;
  startTime: string;
  endTime: string | null;
  title: string;
  kind: DiaryActivityKind;
  done: boolean;
  note: string | null;
  doneAt: string | null;
  doneByName: string | null;
  media: DiaryMedia[];
}

export interface DiaryDay {
  date: string;
  /** Filial vaqti bo'yicha bugungi sana */
  today: string;
  weekday: string | null;
  /** Bola guruhga biriktirilmagan bo'lsa null */
  group: { id: string; name: string } | null;
  /** Faqat ota-ona javobida */
  attendance?: AttendanceStatus | null;
  items: DiaryItem[];
  media: DiaryMedia[];
  summary: { total: number; done: number; photos: number; videos: number };
}

export interface DiaryDaySummary {
  date: string;
  done: number;
  photos: number;
  videos: number;
}

/** Kun tartibi shablonidagi band — tarbiyachi paneli uchun (`GET/PUT /app/diary/groups/:groupId/routine`) */
export interface DiaryRoutineItem {
  id: string;
  startTime: string;
  endTime: string | null;
  title: string;
  kind: DiaryActivityKind;
  weekdays: Weekday[];
  sortOrder: number;
}
