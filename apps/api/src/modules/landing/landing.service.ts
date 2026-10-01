import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { unlink } from "fs/promises";
import { basename, join } from "path";
import { PrismaService } from "../../database/prisma.service";
import { LANDING_UPLOAD_DIR } from "../../common/constants/uploads";
import { normalizeWebsiteHost } from "../../common/website-host";
import { CreateScheduleItemDto } from "./dto/create-schedule-item.dto";
import { UpdateScheduleItemDto } from "./dto/update-schedule-item.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
import { UpdateTeacherDto } from "./dto/update-teacher.dto";
import { UpdateContentBlockDto } from "./dto/update-content-block.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { CreateGroupStudentDto } from "./dto/create-group-student.dto";
import { UpdateGroupStudentDto } from "./dto/update-group-student.dto";
import { CreateLandingApplicationDto } from "./dto/create-landing-application.dto";

/// Lending sahifada foydalaniladigan, oldindan belgilangan matnli blok
/// kalitlari. Admin panelda ham, lending-web'da ham shu kalitlar ishlatiladi.
export const LANDING_CONTENT_BLOCK_KEYS = [
  "doimiy-tarbiyachi",
  "talim-yonalishi",
  "maxsus-oqituvchi-1",
  "maxsus-oqituvchi-2",
] as const;
export type LandingContentBlockKey = (typeof LANDING_CONTENT_BLOCK_KEYS)[number];

@Injectable()
export class LandingService {
  private readonly logger = new Logger(LandingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ochiq o'qish endpointlari (landing-web server-to-server fetch qiladi,
   * brauzer Origin sarlavhasini yubormaydi) va platform-web'dagi "Lending
   * sahifa" bitta "bayroqdor" tashkilotni ko'rsatadi — aynan bitta manba:
   * avval `?org=<slug>` (kelajakdagi ko'p-domenli lending sayt uchun ochiq
   * qoldirilgan, hozircha hech kim yubormaydi), aks holda
   * LANDING_ORGANIZATION_SLUG, aks holda eski sukut "vista-academy" —
   * LandingOwnerGuard o'chirilishidan oldingi xatti-harakat bilan aynan bir xil.
   */
  async resolveDefaultOrganizationId(explicitSlug?: string): Promise<string> {
    const slug = (explicitSlug?.trim() || process.env.LANDING_ORGANIZATION_SLUG?.trim() || "vista-academy").trim();
    const org = await this.prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!org) throw new NotFoundException("Bog'cha topilmadi");
    return org.id;
  }

  /**
   * Yangi rasm qo'yilganda yoki galereya rasmi o'chirilganda, eskisi diskda
   * "yetim" bo'lib qolmasligi uchun shu yordamchi chaqiriladi. Faqat
   * `/uploads/landing/` ostidagi yuklangan fayllarga tegadi — landing-web
   * ichidagi statik (`public/`) rasmlar hech qachon o'chirilmaydi. Fayl allaqachon
   * yo'q bo'lsa jim o'tkazib yuboradi; boshqa xatoliklar asosiy amalni
   * to'xtatmasin deb faqat logga yoziladi.
   */
  private async deleteUploadedPhoto(photoPath: string | null | undefined) {
    if (!photoPath || !photoPath.startsWith("/uploads/landing/")) {
      return;
    }
    try {
      await unlink(join(LANDING_UPLOAD_DIR, basename(photoPath)));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn(`Eski lending rasmini o'chirib bo'lmadi: ${photoPath} (${err})`);
      }
    }
  }

  // --- Kun tartibi / jadval -------------------------------------------------

  listScheduleItems(organizationId: string) {
    return this.prisma.landingScheduleItem.findMany({
      where: { organizationId },
      orderBy: [{ order: "asc" }, { time: "asc" }],
    });
  }

  createScheduleItem(organizationId: string, dto: CreateScheduleItemDto) {
    return this.prisma.landingScheduleItem.create({
      data: { organizationId, time: dto.time, title: dto.title, type: dto.type, order: dto.order ?? 0 },
    });
  }

  async updateScheduleItem(organizationId: string, id: string, dto: UpdateScheduleItemDto) {
    await this.findScheduleItem(organizationId, id);
    return this.prisma.landingScheduleItem.update({ where: { id }, data: dto });
  }

  async deleteScheduleItem(organizationId: string, id: string) {
    await this.findScheduleItem(organizationId, id);
    await this.prisma.landingScheduleItem.delete({ where: { id } });
  }

  private async findScheduleItem(organizationId: string, id: string) {
    const item = await this.prisma.landingScheduleItem.findFirst({ where: { id, organizationId } });
    if (!item) {
      throw new NotFoundException("Jadval qatori topilmadi");
    }
    return item;
  }

  // --- Taomlar ---------------------------------------------------------------

  listMeals(organizationId: string) {
    return this.prisma.landingMeal.findMany({
      where: { organizationId },
      orderBy: [{ weekday: "asc" }, { time: "asc" }, { order: "asc" }, { title: "asc" }],
    });
  }

  createMeal(organizationId: string, dto: CreateMealDto) {
    return this.prisma.landingMeal.create({
      data: {
        organizationId,
        title: dto.title,
        description: dto.description,
        mealType: dto.mealType,
        weekday: dto.weekday,
        time: dto.time,
        order: dto.order ?? 0,
      },
    });
  }

  async updateMeal(organizationId: string, id: string, dto: UpdateMealDto) {
    await this.findMeal(organizationId, id);
    return this.prisma.landingMeal.update({ where: { id }, data: dto });
  }

  async deleteMeal(organizationId: string, id: string) {
    await this.findMeal(organizationId, id);
    await this.prisma.landingMeal.delete({ where: { id } });
  }

  async setMealPhoto(organizationId: string, id: string, photoPath: string) {
    const meal = await this.findMeal(organizationId, id);
    const updated = await this.prisma.landingMeal.update({ where: { id }, data: { photoPath } });
    await this.deleteUploadedPhoto(meal.photoPath);
    return updated;
  }

  private async findMeal(organizationId: string, id: string) {
    const meal = await this.prisma.landingMeal.findFirst({ where: { id, organizationId } });
    if (!meal) {
      throw new NotFoundException("Taom topilmadi");
    }
    return meal;
  }

  // --- O'qituvchilar -----------------------------------------------------------

  listTeachers(organizationId: string) {
    return this.prisma.landingTeacher.findMany({
      where: { organizationId },
      orderBy: [{ order: "asc" }, { fullName: "asc" }],
    });
  }

  createTeacher(organizationId: string, dto: CreateTeacherDto) {
    return this.prisma.landingTeacher.create({
      data: {
        organizationId,
        fullName: dto.fullName,
        role: dto.role,
        bio: dto.bio,
        experience: dto.experience,
        order: dto.order ?? 0,
      },
    });
  }

  async updateTeacher(organizationId: string, id: string, dto: UpdateTeacherDto) {
    await this.findTeacher(organizationId, id);
    return this.prisma.landingTeacher.update({ where: { id }, data: dto });
  }

  async deleteTeacher(organizationId: string, id: string) {
    await this.findTeacher(organizationId, id);
    await this.prisma.landingTeacher.delete({ where: { id } });
  }

  async setTeacherPhoto(organizationId: string, id: string, photoPath: string) {
    const teacher = await this.findTeacher(organizationId, id);
    const updated = await this.prisma.landingTeacher.update({ where: { id }, data: { photoPath } });
    await this.deleteUploadedPhoto(teacher.photoPath);
    return updated;
  }

  private async findTeacher(organizationId: string, id: string) {
    const teacher = await this.prisma.landingTeacher.findFirst({ where: { id, organizationId } });
    if (!teacher) {
      throw new NotFoundException("O'qituvchi topilmadi");
    }
    return teacher;
  }

  // --- Guruhlar ----------------------------------------------------------------

  listGroups(organizationId: string) {
    return this.prisma.landingGroup.findMany({
      where: { organizationId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        photos: { orderBy: { order: "asc" } },
        students: { orderBy: { order: "asc" } },
      },
    });
  }

  async createGroup(organizationId: string, dto: CreateGroupDto) {
    const slug = await this.uniqueGroupSlug(organizationId, dto.name);
    return this.prisma.landingGroup.create({
      data: { organizationId, name: dto.name, slug, order: dto.order ?? 0 },
    });
  }

  async updateGroup(organizationId: string, id: string, dto: UpdateGroupDto) {
    const group = await this.findGroup(organizationId, id);
    const slug = dto.name && dto.name !== group.name ? await this.uniqueGroupSlug(organizationId, dto.name, id) : undefined;
    return this.prisma.landingGroup.update({ where: { id }, data: { ...dto, ...(slug ? { slug } : {}) } });
  }

  async deleteGroup(organizationId: string, id: string) {
    await this.findGroup(organizationId, id);
    await this.prisma.landingGroup.delete({ where: { id } });
  }

  async setGroupPhoto(organizationId: string, id: string, photoPath: string) {
    const group = await this.findGroup(organizationId, id);
    const updated = await this.prisma.landingGroup.update({ where: { id }, data: { photoPath } });
    await this.deleteUploadedPhoto(group.photoPath);
    return updated;
  }

  /** Guruh sahifasidagi galereyaga rasm qo'shadi — oxiriga qo'shiladi. */
  async addGroupPhoto(organizationId: string, groupId: string, path: string) {
    await this.findGroup(organizationId, groupId);
    const count = await this.prisma.landingGroupPhoto.count({ where: { groupId } });
    return this.prisma.landingGroupPhoto.create({ data: { groupId, path, order: count } });
  }

  async deleteGroupPhoto(organizationId: string, groupId: string, photoId: string) {
    const photo = await this.prisma.landingGroupPhoto.findFirst({
      where: { id: photoId, groupId, group: { organizationId } },
    });
    if (!photo) {
      throw new NotFoundException("Rasm topilmadi");
    }
    await this.prisma.landingGroupPhoto.delete({ where: { id: photoId } });
    await this.deleteUploadedPhoto(photo.path);
  }

  /** Guruh sahifasidagi "N-o'quvchi" joylaridan biriga haqiqiy o'quvchi qo'shadi. */
  async createGroupStudent(organizationId: string, groupId: string, dto: CreateGroupStudentDto) {
    await this.findGroup(organizationId, groupId);
    return this.prisma.landingGroupStudent.create({
      data: { groupId, name: dto.name, bio: dto.bio, order: dto.order ?? 0 },
    });
  }

  async updateGroupStudent(organizationId: string, groupId: string, studentId: string, dto: UpdateGroupStudentDto) {
    await this.findGroupStudent(organizationId, groupId, studentId);
    return this.prisma.landingGroupStudent.update({ where: { id: studentId }, data: dto });
  }

  async deleteGroupStudent(organizationId: string, groupId: string, studentId: string) {
    await this.findGroupStudent(organizationId, groupId, studentId);
    await this.prisma.landingGroupStudent.delete({ where: { id: studentId } });
  }

  async setGroupStudentPhoto(organizationId: string, groupId: string, studentId: string, photoPath: string) {
    const student = await this.findGroupStudent(organizationId, groupId, studentId);
    const updated = await this.prisma.landingGroupStudent.update({ where: { id: studentId }, data: { photoPath } });
    await this.deleteUploadedPhoto(student.photoPath);
    return updated;
  }

  private async findGroupStudent(organizationId: string, groupId: string, studentId: string) {
    const student = await this.prisma.landingGroupStudent.findFirst({
      where: { id: studentId, groupId, group: { organizationId } },
    });
    if (!student) {
      throw new NotFoundException("O'quvchi topilmadi");
    }
    return student;
  }

  private async findGroup(organizationId: string, id: string) {
    const group = await this.prisma.landingGroup.findFirst({ where: { id, organizationId } });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    return group;
  }

  /** `name`dan slug hosil qiladi, band bo'lsa (shu tashkilotda, o'zidan boshqa yozuvda) `-2`, `-3` ... qo'shib bo'shini topadi. */
  private async uniqueGroupSlug(organizationId: string, name: string, excludeId?: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "guruh";

    let candidate = base;
    let suffix = 2;
    for (;;) {
      const existing = await this.prisma.landingGroup.findFirst({ where: { organizationId, slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  // --- Matnli bloklar (Doimiy tarbiyachi, Ta'lim yo'nalishi) -------------------

  listContentBlocks(organizationId: string) {
    return this.prisma.landingContentBlock.findMany({ where: { organizationId } });
  }

  async getContentBlock(organizationId: string, key: string) {
    const block = await this.prisma.landingContentBlock.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    if (!block) {
      throw new NotFoundException("Kontent blok topilmadi");
    }
    return block;
  }

  upsertContentBlock(organizationId: string, key: string, dto: UpdateContentBlockDto) {
    return this.prisma.landingContentBlock.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, title: dto.title, body: dto.body },
      update: { title: dto.title, body: dto.body },
    });
  }

  /**
   * Matn hali kiritilmagan bo'lsa ham rasmni oldin yuklash mumkin bo'lishi
   * kerak (masalan "maxsus-oqituvchi-1/2" — admin avval rasm tashlab, keyin
   * matn yozishi tabiiy) — shuning uchun `upsertContentBlock` kabi upsert.
   */
  async setContentBlockPhoto(organizationId: string, key: string, photoPath: string) {
    const existing = await this.prisma.landingContentBlock.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    const updated = await this.prisma.landingContentBlock.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, title: "", body: "", photoPath },
      update: { photoPath },
    });
    await this.deleteUploadedPhoto(existing?.photoPath);
    return updated;
  }

  // --- Arizalar ("Ariza qoldirish" sahifasi) ------------------------------------

  /**
   * Ariza qaysi bog'chaniki ekani aniqlanadi — shu tashkilotning call
   * operatori uni "Bugun qo'ng'iroq qilish" ro'yxatida ko'radi.
   */
  async createApplication(dto: CreateLandingApplicationDto, originHeader?: string) {
    const organizationId = await this.resolveApplicationOrganizationId(dto.organizationSlug, originHeader);
    return this.prisma.landingApplication.create({
      data: { organizationId, fullName: dto.fullName, phone: dto.phone },
    });
  }

  /**
   * Aniqlash tartibi:
   *  1. `dto.organizationSlug` — klient o'zi aniq slug yuborsa (masalan
   *     kelajakda bitta shablonni bir nechta bog'cha ishlatsa, query orqali).
   *     Berilgan-u topilmasa — xato (klientning xatosi).
   *  2. So'rovning Origin (yo'q bo'lsa Referer) hosti — platform panelida
   *     bog'chaga bog'langan "Veb-sayt" domeni bilan solishtiriladi. Bu —
   *     asosiy yo'l: mustaqil lending sayt (masalan Vista-Academy-web) hech
   *     narsa yubormasa ham, brauzer o'zi qo'shadigan Origin sarlavhasi
   *     orqali to'g'ri bog'chaga bog'lanadi.
   *  3. `LANDING_ORGANIZATION_SLUG` — eski, bitta-tashkilotli rejimdagi
   *     server-keng standart (orqaga moslik uchun saqlangan).
   *  Hech biri topilmasa — ariza tashkilotsiz saqlanadi (eski xatti-harakat).
   */
  private async resolveApplicationOrganizationId(
    explicitSlug: string | undefined,
    originHeader: string | undefined,
  ): Promise<string | null> {
    if (explicitSlug?.trim()) {
      const org = await this.prisma.organization.findUnique({
        where: { slug: explicitSlug.trim() },
        select: { id: true },
      });
      if (!org) throw new BadRequestException("Bog'cha topilmadi");
      return org.id;
    }

    const host = originHeader ? normalizeWebsiteHost(originHeader) : null;
    if (host) {
      const org = await this.prisma.organization.findUnique({ where: { website: host }, select: { id: true } });
      if (org) return org.id;
    }

    const fallbackSlug = (process.env.LANDING_ORGANIZATION_SLUG ?? "").trim();
    if (fallbackSlug) {
      const org = await this.prisma.organization.findUnique({ where: { slug: fallbackSlug }, select: { id: true } });
      if (org) return org.id;
    }

    this.logger.warn(
      `Lending arizasi tashkilotsiz saqlandi: origin host=${host ?? "-"} fallbackSlug=${fallbackSlug || "-"}`,
    );
    return null;
  }
}
