import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DiaryMediaKind } from "@prisma/client";
import type { Request, Response } from "express";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsGroup } from "../iam/teacher-scope";
import { DiaryDayService } from "./diary-day.service";
import {
  DIARY_LIMITS,
  PHOTO_MIME_TYPES,
  POSTER_MIME_TYPES,
  VIDEO_MIME_TYPES,
  addDays,
  dateKey,
  isRealDate,
  minutesOf,
  toDateOnly,
  todayIn,
} from "./diary.constants";
import { ReplaceRoutineDto } from "./dto/replace-routine.dto";
import { MarkEntryDto, UpdateEntryDto } from "./dto/mark-entry.dto";
import { UpdateMediaDto, UploadMediaDto } from "./dto/media.dto";

/** Kim yozdi — tarixda ism saqlanadi (xodim keyin o'chirilsa ham) */
export interface DiaryAuthor {
  id: string;
  fullName: string;
}

interface GroupContext {
  id: string;
  name: string;
  branchId: string;
  organizationId: string;
  timezone: string;
}

function assertTimeOrder(startTime: string, endTime: string | null | undefined) {
  if (endTime && minutesOf(endTime) <= minutesOf(startTime)) {
    throw new BadRequestException("Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak");
  }
}

/**
 * Kundalik — tarbiyachi tomoni.
 *
 * Ruxsat: filial xodimlari (moliyachidan tashqari) — `requireTeachingScope`;
 * o'qituvchi faqat o'ziga biriktirilgan guruhlarda (`assertTeacherOwnsGroup`).
 * Super Admin (NETWORK_ADMIN) filialga bog'lanmagani uchun kira olmaydi —
 * boshqa tarbiyachilik modullari bilan bir xil.
 */
@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly days: DiaryDayService,
  ) {}

  /* ------------------------------------------------------------ shablon */

  async getRoutine(scope: TenantScope, groupId: string) {
    const group = await this.requireGroup(scope, groupId);
    return this.prisma.diaryRoutineItem.findMany({
      where: { groupId: group.id },
      orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
      select: { id: true, startTime: true, endTime: true, title: true, kind: true, weekdays: true, sortOrder: true },
    });
  }

  /**
   * Shablonni butunligicha saqlaydi. `id` li bandlar yangilanadi, `id` siz —
   * yaratiladi, ro'yxatda yo'qlari o'chiriladi. O'chirilgan bandning o'tgan
   * kunlardagi belgilari saqlanib qoladi (nomi va vaqti nusxalangan).
   */
  async replaceRoutine(scope: TenantScope, groupId: string, dto: ReplaceRoutineDto) {
    const group = await this.requireGroup(scope, groupId);
    for (const item of dto.items) {
      assertTimeOrder(item.startTime, item.endTime);
    }

    const existing = await this.prisma.diaryRoutineItem.findMany({ where: { groupId: group.id }, select: { id: true } });
    const existingIds = new Set(existing.map((row) => row.id));
    const keptIds = new Set<string>();
    for (const item of dto.items) {
      if (!item.id) continue;
      if (!existingIds.has(item.id)) {
        throw new BadRequestException("Kun tartibidagi band topilmadi — sahifani yangilab qayta urinib ko'ring");
      }
      if (keptIds.has(item.id)) {
        throw new BadRequestException("Bitta band ikki marta yuborildi");
      }
      keptIds.add(item.id);
    }

    await this.prisma.$transaction([
      this.prisma.diaryRoutineItem.deleteMany({
        where: { groupId: group.id, id: { notIn: [...keptIds] } },
      }),
      ...dto.items.map((item, index) => {
        const data = {
          startTime: item.startTime,
          endTime: item.endTime ?? null,
          title: item.title.trim(),
          kind: item.kind,
          weekdays: item.weekdays,
          sortOrder: index,
        };
        return item.id
          ? this.prisma.diaryRoutineItem.update({ where: { id: item.id }, data })
          : this.prisma.diaryRoutineItem.create({
              data: { ...data, organizationId: group.organizationId, branchId: group.branchId, groupId: group.id },
            });
      }),
    ]);

    return this.getRoutine(scope, groupId);
  }

  /* ------------------------------------------------------------ kunlar */

  async getDay(scope: TenantScope, groupId: string, date: string) {
    const group = await this.requireGroup(scope, groupId);
    this.requireDate(date);
    return { ...(await this.days.buildDay(group, date)), today: todayIn(group.timezone) };
  }

  /** Oraliq bo'yicha qisqa hisob (sukut — oxirgi 14 kun), eng yangisi birinchi */
  async listDays(scope: TenantScope, groupId: string, from?: string, to?: string) {
    const group = await this.requireGroup(scope, groupId);
    const today = todayIn(group.timezone);
    const end = to ?? today;
    const start = from ?? dateKey(addDays(toDateOnly(end), -13));
    this.requireDate(start);
    this.requireDate(end);
    if (start > end) {
      throw new BadRequestException("Boshlanish sanasi tugash sanasidan oldin bo'lishi kerak");
    }
    if (toDateOnly(end).getTime() - toDateOnly(start).getTime() > 92 * 86_400_000) {
      throw new BadRequestException("Oraliq 3 oydan oshmasligi kerak");
    }
    return this.days.summaries(group.id, start, end);
  }

  /* ------------------------------------------------------------ belgilar */

  async markEntry(scope: TenantScope, author: DiaryAuthor, groupId: string, date: string, dto: MarkEntryDto) {
    const group = await this.requireGroup(scope, groupId);
    this.requirePastOrToday(group, date);
    const dateOnly = toDateOnly(date);

    if (dto.routineItemId) {
      const item = await this.prisma.diaryRoutineItem.findFirst({
        where: { id: dto.routineItemId, groupId: group.id },
      });
      if (!item) {
        throw new NotFoundException("Kun tartibidagi band topilmadi");
      }
      const startTime = dto.startTime ?? item.startTime;
      const endTime = dto.endTime === undefined ? item.endTime : dto.endTime;
      assertTimeOrder(startTime, endTime);
      return this.prisma.diaryEntry.upsert({
        where: { routineItemId_date: { routineItemId: item.id, date: dateOnly } },
        create: {
          organizationId: group.organizationId,
          branchId: group.branchId,
          groupId: group.id,
          date: dateOnly,
          routineItemId: item.id,
          startTime,
          endTime,
          title: dto.title?.trim() ?? item.title,
          kind: dto.kind ?? item.kind,
          note: dto.note?.trim() || null,
          createdById: author.id,
          createdByName: author.fullName,
        },
        update: {
          ...(dto.note !== undefined && { note: dto.note.trim() || null }),
          ...(dto.startTime && { startTime: dto.startTime }),
          ...(dto.endTime !== undefined && { endTime: dto.endTime }),
          ...(dto.title && { title: dto.title.trim() }),
          ...(dto.kind && { kind: dto.kind }),
        },
      });
    }

    if (!dto.startTime || !dto.title?.trim()) {
      throw new BadRequestException("Kun tartibida yo'q voqea uchun vaqt va nom kiritilishi kerak");
    }
    assertTimeOrder(dto.startTime, dto.endTime);
    return this.prisma.diaryEntry.create({
      data: {
        organizationId: group.organizationId,
        branchId: group.branchId,
        groupId: group.id,
        date: dateOnly,
        startTime: dto.startTime,
        endTime: dto.endTime ?? null,
        title: dto.title.trim(),
        kind: dto.kind ?? "OTHER",
        note: dto.note?.trim() || null,
        createdById: author.id,
        createdByName: author.fullName,
      },
    });
  }

  async updateEntry(scope: TenantScope, entryId: string, dto: UpdateEntryDto) {
    const entry = await this.requireEntry(scope, entryId);
    const startTime = dto.startTime ?? entry.startTime;
    const endTime = dto.endTime === undefined ? entry.endTime : dto.endTime;
    assertTimeOrder(startTime, endTime);
    return this.prisma.diaryEntry.update({
      where: { id: entry.id },
      data: {
        ...(dto.note !== undefined && { note: dto.note?.trim() || null }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
        ...(dto.title && { title: dto.title.trim() }),
        ...(dto.kind && { kind: dto.kind }),
      },
    });
  }

  /** Belgini bekor qilish. Unga biriktirilgan lahzalar o'chmaydi — kunning umumiy lahzalariga o'tadi. */
  async deleteEntry(scope: TenantScope, entryId: string) {
    const entry = await this.requireEntry(scope, entryId);
    await this.prisma.diaryEntry.delete({ where: { id: entry.id } });
    return { deleted: true };
  }

  /* ------------------------------------------------------------ media */

  async addMedia(
    scope: TenantScope,
    author: DiaryAuthor,
    groupId: string,
    date: string,
    files: { file?: Express.Multer.File[]; poster?: Express.Multer.File[] },
    dto: UploadMediaDto,
  ) {
    const group = await this.requireGroup(scope, groupId);
    this.requirePastOrToday(group, date);
    const dateOnly = toDateOnly(date);

    const file = files.file?.[0];
    if (!file || file.size === 0) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    const kind = (PHOTO_MIME_TYPES as readonly string[]).includes(file.mimetype)
      ? DiaryMediaKind.PHOTO
      : (VIDEO_MIME_TYPES as readonly string[]).includes(file.mimetype)
        ? DiaryMediaKind.VIDEO
        : null;
    if (!kind) {
      throw new BadRequestException("Faqat rasm (jpeg, png, webp) yoki video (mp4, webm, mov) yuklash mumkin");
    }
    const maxBytes = kind === DiaryMediaKind.PHOTO ? DIARY_LIMITS.photoMaxBytes : DIARY_LIMITS.videoMaxBytes;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        kind === DiaryMediaKind.PHOTO
          ? `Rasm ${DIARY_LIMITS.photoMaxBytes / 1024 / 1024} MB dan oshmasligi kerak`
          : `Video ${DIARY_LIMITS.videoMaxBytes / 1024 / 1024} MB dan oshmasligi kerak — qisqaroq video yuklang`,
      );
    }

    const poster = files.poster?.[0];
    if (poster) {
      if (kind !== DiaryMediaKind.VIDEO) {
        throw new BadRequestException("Muqova faqat video uchun yuboriladi");
      }
      if (!(POSTER_MIME_TYPES as readonly string[]).includes(poster.mimetype) || poster.size > DIARY_LIMITS.posterMaxBytes) {
        throw new BadRequestException("Video muqovasi 500 KB gacha rasm bo'lishi kerak");
      }
    }

    if (dto.entryId) {
      const entry = await this.prisma.diaryEntry.findFirst({
        where: { id: dto.entryId, groupId: group.id, date: dateOnly },
        select: { id: true },
      });
      if (!entry) {
        throw new BadRequestException("Mashg'ulot belgisi shu kunga tegishli emas");
      }
    }

    const sameDay = await this.prisma.diaryMedia.count({ where: { groupId: group.id, date: dateOnly, kind } });
    const dayLimit = kind === DiaryMediaKind.PHOTO ? DIARY_LIMITS.photosPerDay : DIARY_LIMITS.videosPerDay;
    if (sameDay >= dayLimit) {
      throw new BadRequestException(
        kind === DiaryMediaKind.PHOTO
          ? `Bir kunda ${DIARY_LIMITS.photosPerDay} tagacha rasm yuklash mumkin`
          : `Bir kunda ${DIARY_LIMITS.videosPerDay} tagacha video yuklash mumkin`,
      );
    }

    const created = await this.prisma.diaryMedia.create({
      data: {
        organizationId: group.organizationId,
        branchId: group.branchId,
        groupId: group.id,
        date: dateOnly,
        entryId: dto.entryId ?? null,
        kind,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        // Prisma `Uint8Array<ArrayBuffer>` kutadi; multer Buffer'i umumiy xotirada bo'lishi mumkin
        data: new Uint8Array(file.buffer),
        posterData: poster ? new Uint8Array(poster.buffer) : null,
        posterMimeType: poster?.mimetype ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        durationSeconds: kind === DiaryMediaKind.VIDEO ? (dto.durationSeconds ?? null) : null,
        caption: dto.caption?.trim() || null,
        createdById: author.id,
        createdByName: author.fullName,
      },
      select: { id: true },
    });
    const day = await this.days.buildDay(group, date);
    return [...day.media, ...day.items.flatMap((item) => item.media)].find((m) => m.id === created.id);
  }

  async updateMedia(scope: TenantScope, mediaId: string, dto: UpdateMediaDto) {
    const media = await this.requireMedia(scope, mediaId);
    if (dto.entryId) {
      const entry = await this.prisma.diaryEntry.findFirst({
        where: { id: dto.entryId, groupId: media.groupId, date: media.date },
        select: { id: true },
      });
      if (!entry) {
        throw new BadRequestException("Mashg'ulot belgisi shu kunga tegishli emas");
      }
    }
    await this.prisma.diaryMedia.update({
      where: { id: media.id },
      data: {
        ...(dto.caption !== undefined && { caption: dto.caption?.trim() || null }),
        ...(dto.entryId !== undefined && { entryId: dto.entryId }),
      },
    });
    return { updated: true };
  }

  async deleteMedia(scope: TenantScope, mediaId: string) {
    const media = await this.requireMedia(scope, mediaId);
    await this.prisma.diaryMedia.delete({ where: { id: media.id } });
    return { deleted: true };
  }

  async sendMedia(scope: TenantScope, mediaId: string, variant: "file" | "poster", req: Request, res: Response) {
    await this.requireMedia(scope, mediaId);
    await this.days.send(mediaId, variant, req, res);
  }

  /* ------------------------------------------------------------ yordamchilar */

  private async requireGroup(scope: TenantScope, groupId: string): Promise<GroupContext> {
    const branchId = requireTeachingScope(scope);
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, branchId, branch: { organizationId: scope.organizationId } },
      select: { id: true, name: true, branchId: true, branch: { select: { organizationId: true, timezone: true } } },
    });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    await assertTeacherOwnsGroup(this.prisma, scope, group.id);
    return {
      id: group.id,
      name: group.name,
      branchId: group.branchId,
      organizationId: group.branch.organizationId,
      timezone: group.branch.timezone,
    };
  }

  private async requireEntry(scope: TenantScope, entryId: string) {
    const entry = await this.prisma.diaryEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.organizationId !== scope.organizationId) {
      throw new NotFoundException("Belgi topilmadi");
    }
    await this.requireGroup(scope, entry.groupId);
    return entry;
  }

  private async requireMedia(scope: TenantScope, mediaId: string) {
    const media = await this.prisma.diaryMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, groupId: true, organizationId: true, date: true },
    });
    if (!media || media.organizationId !== scope.organizationId) {
      throw new NotFoundException("Fayl topilmadi");
    }
    await this.requireGroup(scope, media.groupId);
    return media;
  }

  private requireDate(date: string) {
    if (!isRealDate(date)) {
      throw new BadRequestException("Sana YYYY-MM-DD formatida bo'lishi kerak");
    }
  }

  /** Kelajak kun uchun belgi yoki rasm qo'yib bo'lmaydi */
  private requirePastOrToday(group: GroupContext, date: string) {
    this.requireDate(date);
    if (date > todayIn(group.timezone)) {
      throw new BadRequestException("Hali kelmagan kun uchun belgi qo'yib bo'lmaydi");
    }
  }
}
