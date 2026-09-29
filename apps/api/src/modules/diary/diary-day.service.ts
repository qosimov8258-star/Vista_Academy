import { Injectable, NotFoundException } from "@nestjs/common";
import { DiaryActivityKind, DiaryMediaKind, Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { PrismaService } from "../../database/prisma.service";
import { addDays, dateKey, minutesOf, toDateOnly, weekdayOf } from "./diary.constants";

/** Ro'yxatlarda media — faylning o'zisiz (`data` hech qachon tanlanmaydi) */
export const DIARY_MEDIA_SELECT = {
  id: true,
  entryId: true,
  kind: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationSeconds: true,
  caption: true,
  posterMimeType: true,
  createdAt: true,
  createdByName: true,
} satisfies Prisma.DiaryMediaSelect;

type MediaRow = Prisma.DiaryMediaGetPayload<{ select: typeof DIARY_MEDIA_SELECT }>;

export interface DiaryMediaView {
  id: string;
  entryId: string | null;
  kind: DiaryMediaKind;
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

export interface DiaryItemView {
  /** Barqaror kalit: shablon bandi uchun uning id si, qo'shimcha voqea uchun `entry:<id>` */
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
  media: DiaryMediaView[];
}

export interface DiaryDayView {
  date: string;
  weekday: string;
  group: { id: string; name: string };
  items: DiaryItemView[];
  /** Hech bir bandga bog'lanmagan lahzalar */
  media: DiaryMediaView[];
  summary: { total: number; done: number; photos: number; videos: number };
}

export interface DiaryDaySummary {
  date: string;
  done: number;
  photos: number;
  videos: number;
}

function toMediaView(row: MediaRow): DiaryMediaView {
  return {
    id: row.id,
    entryId: row.entryId,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    caption: row.caption,
    hasPoster: row.posterMimeType !== null,
    createdAt: row.createdAt.toISOString(),
    createdByName: row.createdByName,
  };
}

/**
 * Kundalikning o'qish qismi — tarbiyachi paneli ham, ota-ona kabineti ham
 * aynan shu ko'rinishni oladi. Ruxsatni chaqiruvchi tekshiradi: bu xizmat
 * guruh kimga tegishli ekanini bilmaydi.
 */
@Injectable()
export class DiaryDayService {
  constructor(private readonly prisma: PrismaService) {}

  async buildDay(group: { id: string; name: string }, date: string): Promise<DiaryDayView> {
    const dateOnly = toDateOnly(date);
    const weekday = weekdayOf(date);

    const [routine, entries, media] = await Promise.all([
      this.prisma.diaryRoutineItem.findMany({
        where: { groupId: group.id, weekdays: { has: weekday } },
        orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
      }),
      this.prisma.diaryEntry.findMany({
        where: { groupId: group.id, date: dateOnly },
        orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.diaryMedia.findMany({
        where: { groupId: group.id, date: dateOnly },
        select: DIARY_MEDIA_SELECT,
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const mediaViews = media.map(toMediaView);
    const mediaOf = (entryId: string | null) => (entryId ? mediaViews.filter((m) => m.entryId === entryId) : []);
    const entryByRoutine = new Map(entries.filter((e) => e.routineItemId).map((e) => [e.routineItemId as string, e]));

    const items: DiaryItemView[] = routine.map((item) => {
      const entry = entryByRoutine.get(item.id);
      return {
        key: item.id,
        routineItemId: item.id,
        entryId: entry?.id ?? null,
        // Belgilangan bo'lsa — o'sha kungi nusxa (shablon keyin o'zgargan bo'lishi mumkin)
        startTime: entry?.startTime ?? item.startTime,
        endTime: entry ? entry.endTime : item.endTime,
        title: entry?.title ?? item.title,
        kind: entry?.kind ?? item.kind,
        done: Boolean(entry),
        note: entry?.note ?? null,
        doneAt: entry?.createdAt.toISOString() ?? null,
        doneByName: entry?.createdByName ?? null,
        media: mediaOf(entry?.id ?? null),
      };
    });

    // Shablonda yo'q (yoki bugun rejalashtirilmagan) belgilar ham tarixda qoladi
    const scheduled = new Set(routine.map((item) => item.id));
    for (const entry of entries) {
      if (entry.routineItemId && scheduled.has(entry.routineItemId)) continue;
      items.push({
        key: entry.routineItemId ?? `entry:${entry.id}`,
        routineItemId: entry.routineItemId,
        entryId: entry.id,
        startTime: entry.startTime,
        endTime: entry.endTime,
        title: entry.title,
        kind: entry.kind,
        done: true,
        note: entry.note,
        doneAt: entry.createdAt.toISOString(),
        doneByName: entry.createdByName,
        media: mediaOf(entry.id),
      });
    }

    // Barqaror saralash: bir vaqtdagi bandlar shablondagi tartibida qoladi
    items.sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));

    const attached = new Set(entries.map((e) => e.id));
    return {
      date,
      weekday,
      group: { id: group.id, name: group.name },
      items,
      media: mediaViews.filter((m) => !m.entryId || !attached.has(m.entryId)),
      summary: {
        total: items.length,
        done: items.filter((item) => item.done).length,
        photos: mediaViews.filter((m) => m.kind === DiaryMediaKind.PHOTO).length,
        videos: mediaViews.filter((m) => m.kind === DiaryMediaKind.VIDEO).length,
      },
    };
  }

  /** Kunlar tasmasi uchun: har kuni nechta belgi va lahza bor (eng yangisi birinchi) */
  async summaries(groupId: string, from: string, to: string): Promise<DiaryDaySummary[]> {
    const where = { groupId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } };
    const [entryCounts, mediaCounts] = await Promise.all([
      this.prisma.diaryEntry.groupBy({ by: ["date"], where, _count: { _all: true } }),
      this.prisma.diaryMedia.groupBy({ by: ["date", "kind"], where, _count: { _all: true } }),
    ]);

    const result: DiaryDaySummary[] = [];
    for (let cursor = toDateOnly(to); cursor >= toDateOnly(from); cursor = addDays(cursor, -1)) {
      const key = dateKey(cursor);
      const same = (d: Date) => dateKey(d) === key;
      result.push({
        date: key,
        done: entryCounts.find((row) => same(row.date))?._count._all ?? 0,
        photos: mediaCounts.find((row) => same(row.date) && row.kind === DiaryMediaKind.PHOTO)?._count._all ?? 0,
        videos: mediaCounts.find((row) => same(row.date) && row.kind === DiaryMediaKind.VIDEO)?._count._all ?? 0,
      });
    }
    return result;
  }

  /** Media qaysi guruhga tegishli — ruxsat tekshiruvi uchun (fayl o'qilmaydi) */
  async mediaGroupId(mediaId: string): Promise<string> {
    const row = await this.prisma.diaryMedia.findUnique({ where: { id: mediaId }, select: { groupId: true } });
    if (!row) {
      throw new NotFoundException("Fayl topilmadi");
    }
    return row.groupId;
  }

  /**
   * Faylni yuboradi. Video uchun `Range` so'rovlari qo'llab-quvvatlanadi —
   * iPhone Safari videoni aynan shu orqali o'ynatadi, aks holda ochilmaydi.
   * Ruxsat bu metoddan OLDIN tekshirilgan bo'lishi kerak.
   */
  async send(mediaId: string, variant: "file" | "poster", req: Request, res: Response): Promise<void> {
    let data: Uint8Array | null = null;
    let mimeType: string | null = null;
    if (variant === "file") {
      const row = await this.prisma.diaryMedia.findUnique({ where: { id: mediaId }, select: { data: true, mimeType: true } });
      data = row?.data ?? null;
      mimeType = row?.mimeType ?? null;
    } else {
      const row = await this.prisma.diaryMedia.findUnique({
        where: { id: mediaId },
        select: { posterData: true, posterMimeType: true },
      });
      data = row?.posterData ?? null;
      mimeType = row?.posterMimeType ?? null;
    }
    if (!data || !mimeType) {
      throw new NotFoundException(variant === "poster" ? "Muqova yo'q" : "Fayl topilmadi");
    }

    const buffer = Buffer.from(data);
    const total = buffer.byteLength;
    // Fayl id bo'yicha o'zgarmaydi — brauzer uzoq saqlasin
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");

    const range = req.headers.range;
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (match && (match[1] || match[2])) {
      let start = match[1] ? Number(match[1]) : total - Number(match[2]);
      let end = match[1] && match[2] ? Number(match[2]) : total - 1;
      start = Math.max(0, start);
      end = Math.min(end, total - 1);
      if (start > end || start >= total) {
        res.status(416).setHeader("Content-Range", `bytes */${total}`);
        res.end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", String(end - start + 1));
      res.end(buffer.subarray(start, end + 1));
      return;
    }

    res.setHeader("Content-Length", String(total));
    res.end(buffer);
  }
}
