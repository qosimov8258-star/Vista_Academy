import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { unlink } from "fs/promises";
import { basename, join } from "path";
import { PrismaService } from "../../database/prisma.service";
import { LANDING_UPLOAD_DIR } from "../../common/constants/uploads";
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

  listScheduleItems() {
    return this.prisma.landingScheduleItem.findMany({ orderBy: [{ order: "asc" }, { time: "asc" }] });
  }

  createScheduleItem(dto: CreateScheduleItemDto) {
    return this.prisma.landingScheduleItem.create({
      data: { time: dto.time, title: dto.title, type: dto.type, order: dto.order ?? 0 },
    });
  }

  async updateScheduleItem(id: string, dto: UpdateScheduleItemDto) {
    await this.findScheduleItem(id);
    return this.prisma.landingScheduleItem.update({ where: { id }, data: dto });
  }

  async deleteScheduleItem(id: string) {
    await this.findScheduleItem(id);
    await this.prisma.landingScheduleItem.delete({ where: { id } });
  }

  private async findScheduleItem(id: string) {
    const item = await this.prisma.landingScheduleItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Jadval qatori topilmadi");
    }
    return item;
  }

  // --- Taomlar ---------------------------------------------------------------

  listMeals() {
    return this.prisma.landingMeal.findMany({
      orderBy: [{ weekday: "asc" }, { time: "asc" }, { order: "asc" }, { title: "asc" }],
    });
  }

  createMeal(dto: CreateMealDto) {
    return this.prisma.landingMeal.create({
      data: {
        title: dto.title,
        description: dto.description,
        mealType: dto.mealType,
        weekday: dto.weekday,
        time: dto.time,
        order: dto.order ?? 0,
      },
    });
  }

  async updateMeal(id: string, dto: UpdateMealDto) {
    await this.findMeal(id);
    return this.prisma.landingMeal.update({ where: { id }, data: dto });
  }

  async deleteMeal(id: string) {
    await this.findMeal(id);
    await this.prisma.landingMeal.delete({ where: { id } });
  }

  async setMealPhoto(id: string, photoPath: string) {
    const meal = await this.findMeal(id);
    const updated = await this.prisma.landingMeal.update({ where: { id }, data: { photoPath } });
    await this.deleteUploadedPhoto(meal.photoPath);
    return updated;
  }

  private async findMeal(id: string) {
    const meal = await this.prisma.landingMeal.findUnique({ where: { id } });
    if (!meal) {
      throw new NotFoundException("Taom topilmadi");
    }
    return meal;
  }

  // --- O'qituvchilar -----------------------------------------------------------

  /**
   * Landing-web'dagi "O'qituvchilar" sahifasi CMS bo'sh bo'lganda ham
   * bo'sh ko'rinmasin deb, xuddi shu 4 nafar namunaviy o'qituvchini
   * (apps/landing-web/src/app/oqituvchilar/page.tsx dagi PLACEHOLDER_TEACHERS)
   * qattiq yozib qo'yadi. Admin panelda ham shu 4 tasi darhol ko'rinishi
   * uchun bazada hali yo'q bo'lsa shu yerda avtomatik yaratiladi — shunday
   * qilib admin faqat mavjudlarini TAHRIRLAYDI, yangisini yaratishga hojat
   * qolmaydi, saytning ko'rinishi esa o'zgarmaydi.
   */
  private static readonly DEFAULT_TEACHERS = [
    {
      fullName: "Dilnoza Qosimova",
      role: "Bosh tarbiyachi",
      bio: "Har bir bola menga o'z farzandimdek aziz.",
      experience: "Maktabgacha ta'lim yo'nalishida 12 yillik tajribaga ega, bir necha filial jamoasini boshqargan.",
    },
    {
      fullName: "Malika Yusupova",
      role: "Ingliz tili o'qituvchisi",
      bio: "Bolalar bilan o'ynab o'rganish eng samarali usul.",
      experience: "Ingliz tili bo'yicha 6 yillik tajriba, xalqaro IELTS sertifikatiga ega, kichik yoshdagilar bilan ishlash metodikasi bo'yicha malaka oshirgan.",
    },
    {
      fullName: "Nodira Karimova",
      role: "Mental arifmetika o'qituvchisi",
      bio: "Mental arifmetika bolaning tafakkurini rivojlantiradi.",
      experience: "Mental arifmetika yo'nalishida 5 yillik tajriba, respublika miqyosidagi bolalar musobaqalarida shogirdlarini tayyorlagan.",
    },
    {
      fullName: "Sevara Rashidova",
      role: "Kichik guruh tarbiyachisi",
      bio: "Sabr va mehr — ishimning asosi.",
      experience: "Kichik yoshdagi bolalar bilan ishlashda 8 yillik tajribaga ega, bolalar psixologiyasi bo'yicha qo'shimcha ta'lim olgan.",
    },
  ];

  async listTeachers() {
    const existing = await this.prisma.landingTeacher.findMany({ orderBy: [{ order: "asc" }, { fullName: "asc" }] });
    if (existing.length >= LandingService.DEFAULT_TEACHERS.length) {
      return existing;
    }

    const missing = LandingService.DEFAULT_TEACHERS.slice(existing.length);
    await this.prisma.landingTeacher.createMany({
      data: missing.map((teacher, i) => ({ ...teacher, order: existing.length + i })),
    });
    return this.prisma.landingTeacher.findMany({ orderBy: [{ order: "asc" }, { fullName: "asc" }] });
  }

  createTeacher(dto: CreateTeacherDto) {
    return this.prisma.landingTeacher.create({
      data: { fullName: dto.fullName, role: dto.role, bio: dto.bio, experience: dto.experience, order: dto.order ?? 0 },
    });
  }

  async updateTeacher(id: string, dto: UpdateTeacherDto) {
    await this.findTeacher(id);
    return this.prisma.landingTeacher.update({ where: { id }, data: dto });
  }

  async deleteTeacher(id: string) {
    await this.findTeacher(id);
    await this.prisma.landingTeacher.delete({ where: { id } });
  }

  async setTeacherPhoto(id: string, photoPath: string) {
    const teacher = await this.findTeacher(id);
    const updated = await this.prisma.landingTeacher.update({ where: { id }, data: { photoPath } });
    await this.deleteUploadedPhoto(teacher.photoPath);
    return updated;
  }

  private async findTeacher(id: string) {
    const teacher = await this.prisma.landingTeacher.findUnique({ where: { id } });
    if (!teacher) {
      throw new NotFoundException("O'qituvchi topilmadi");
    }
    return teacher;
  }

  // --- Guruhlar ----------------------------------------------------------------

  listGroups() {
    return this.prisma.landingGroup.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        photos: { orderBy: { order: "asc" } },
        students: { orderBy: { order: "asc" } },
      },
    });
  }

  async createGroup(dto: CreateGroupDto) {
    const slug = await this.uniqueGroupSlug(dto.name);
    return this.prisma.landingGroup.create({
      data: { name: dto.name, slug, order: dto.order ?? 0 },
    });
  }

  async updateGroup(id: string, dto: UpdateGroupDto) {
    const group = await this.findGroup(id);
    const slug = dto.name && dto.name !== group.name ? await this.uniqueGroupSlug(dto.name, id) : undefined;
    return this.prisma.landingGroup.update({ where: { id }, data: { ...dto, ...(slug ? { slug } : {}) } });
  }

  async deleteGroup(id: string) {
    await this.findGroup(id);
    await this.prisma.landingGroup.delete({ where: { id } });
  }

  async setGroupPhoto(id: string, photoPath: string) {
    const group = await this.findGroup(id);
    const updated = await this.prisma.landingGroup.update({ where: { id }, data: { photoPath } });
    await this.deleteUploadedPhoto(group.photoPath);
    return updated;
  }

  /** Guruh sahifasidagi galereyaga rasm qo'shadi — oxiriga qo'shiladi. */
  async addGroupPhoto(groupId: string, path: string) {
    await this.findGroup(groupId);
    const count = await this.prisma.landingGroupPhoto.count({ where: { groupId } });
    return this.prisma.landingGroupPhoto.create({ data: { groupId, path, order: count } });
  }

  async deleteGroupPhoto(groupId: string, photoId: string) {
    const photo = await this.prisma.landingGroupPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.groupId !== groupId) {
      throw new NotFoundException("Rasm topilmadi");
    }
    await this.prisma.landingGroupPhoto.delete({ where: { id: photoId } });
    await this.deleteUploadedPhoto(photo.path);
  }

  /** Guruh sahifasidagi "N-o'quvchi" joylaridan biriga haqiqiy o'quvchi qo'shadi. */
  async createGroupStudent(groupId: string, dto: CreateGroupStudentDto) {
    await this.findGroup(groupId);
    return this.prisma.landingGroupStudent.create({
      data: { groupId, name: dto.name, bio: dto.bio, order: dto.order ?? 0 },
    });
  }

  async updateGroupStudent(groupId: string, studentId: string, dto: UpdateGroupStudentDto) {
    await this.findGroupStudent(groupId, studentId);
    return this.prisma.landingGroupStudent.update({ where: { id: studentId }, data: dto });
  }

  async deleteGroupStudent(groupId: string, studentId: string) {
    await this.findGroupStudent(groupId, studentId);
    await this.prisma.landingGroupStudent.delete({ where: { id: studentId } });
  }

  async setGroupStudentPhoto(groupId: string, studentId: string, photoPath: string) {
    const student = await this.findGroupStudent(groupId, studentId);
    const updated = await this.prisma.landingGroupStudent.update({ where: { id: studentId }, data: { photoPath } });
    await this.deleteUploadedPhoto(student.photoPath);
    return updated;
  }

  private async findGroupStudent(groupId: string, studentId: string) {
    const student = await this.prisma.landingGroupStudent.findUnique({ where: { id: studentId } });
    if (!student || student.groupId !== groupId) {
      throw new NotFoundException("O'quvchi topilmadi");
    }
    return student;
  }

  private async findGroup(id: string) {
    const group = await this.prisma.landingGroup.findUnique({ where: { id } });
    if (!group) {
      throw new NotFoundException("Guruh topilmadi");
    }
    return group;
  }

  /** `name`dan slug hosil qiladi, band bo'lsa (o'zidan boshqa yozuvda) `-2`, `-3` ... qo'shib bo'shini topadi. */
  private async uniqueGroupSlug(name: string, excludeId?: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "guruh";

    let candidate = base;
    let suffix = 2;
    for (;;) {
      const existing = await this.prisma.landingGroup.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  // --- Matnli bloklar (Doimiy tarbiyachi, Ta'lim yo'nalishi) -------------------

  listContentBlocks() {
    return this.prisma.landingContentBlock.findMany();
  }

  async getContentBlock(key: string) {
    const block = await this.prisma.landingContentBlock.findUnique({ where: { key } });
    if (!block) {
      throw new NotFoundException("Kontent blok topilmadi");
    }
    return block;
  }

  upsertContentBlock(key: string, dto: UpdateContentBlockDto) {
    return this.prisma.landingContentBlock.upsert({
      where: { key },
      create: { key, title: dto.title, body: dto.body },
      update: { title: dto.title, body: dto.body },
    });
  }

  /**
   * Matn hali kiritilmagan bo'lsa ham rasmni oldin yuklash mumkin bo'lishi
   * kerak (masalan "maxsus-oqituvchi-1/2" — admin avval rasm tashlab, keyin
   * matn yozishi tabiiy) — shuning uchun `upsertContentBlock` kabi upsert.
   */
  async setContentBlockPhoto(key: string, photoPath: string) {
    const existing = await this.prisma.landingContentBlock.findUnique({ where: { key } });
    const updated = await this.prisma.landingContentBlock.upsert({
      where: { key },
      create: { key, title: "", body: "", photoPath },
      update: { photoPath },
    });
    await this.deleteUploadedPhoto(existing?.photoPath);
    return updated;
  }

  // --- Arizalar ("Ariza qoldirish" sahifasi) ------------------------------------

  createApplication(dto: CreateLandingApplicationDto) {
    return this.prisma.landingApplication.create({
      data: { fullName: dto.fullName, phone: dto.phone },
    });
  }
}
