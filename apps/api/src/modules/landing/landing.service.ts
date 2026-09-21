import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateScheduleItemDto } from "./dto/create-schedule-item.dto";
import { UpdateScheduleItemDto } from "./dto/update-schedule-item.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
import { UpdateTeacherDto } from "./dto/update-teacher.dto";
import { UpdateContentBlockDto } from "./dto/update-content-block.dto";

/// Lending sahifada foydalaniladigan, oldindan belgilangan matnli blok
/// kalitlari. Admin panelda ham, lending-web'da ham shu kalitlar ishlatiladi.
export const LANDING_CONTENT_BLOCK_KEYS = ["doimiy-tarbiyachi", "talim-yonalishi"] as const;
export type LandingContentBlockKey = (typeof LANDING_CONTENT_BLOCK_KEYS)[number];

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.findMeal(id);
    return this.prisma.landingMeal.update({ where: { id }, data: { photoPath } });
  }

  private async findMeal(id: string) {
    const meal = await this.prisma.landingMeal.findUnique({ where: { id } });
    if (!meal) {
      throw new NotFoundException("Taom topilmadi");
    }
    return meal;
  }

  // --- O'qituvchilar -----------------------------------------------------------

  listTeachers() {
    return this.prisma.landingTeacher.findMany({ orderBy: [{ order: "asc" }, { fullName: "asc" }] });
  }

  createTeacher(dto: CreateTeacherDto) {
    return this.prisma.landingTeacher.create({
      data: { fullName: dto.fullName, role: dto.role, bio: dto.bio, order: dto.order ?? 0 },
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
    await this.findTeacher(id);
    return this.prisma.landingTeacher.update({ where: { id }, data: { photoPath } });
  }

  private async findTeacher(id: string) {
    const teacher = await this.prisma.landingTeacher.findUnique({ where: { id } });
    if (!teacher) {
      throw new NotFoundException("O'qituvchi topilmadi");
    }
    return teacher;
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

  async setContentBlockPhoto(key: string, photoPath: string) {
    const block = await this.prisma.landingContentBlock.findUnique({ where: { key } });
    if (!block) {
      throw new NotFoundException("Kontent blok topilmadi");
    }
    return this.prisma.landingContentBlock.update({ where: { key }, data: { photoPath } });
  }
}
