import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { LandingService } from "./landing.service";
import { landingPhotoUploadInterceptor } from "./landing-upload.util";
import { CreateScheduleItemDto } from "./dto/create-schedule-item.dto";
import { UpdateScheduleItemDto } from "./dto/update-schedule-item.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
import { UpdateTeacherDto } from "./dto/update-teacher.dto";
import { UpdateContentBlockDto } from "./dto/update-content-block.dto";

/**
 * Lending sahifa (landing-web) kontentini boshqarish — Platform Super Admin
 * platform-web'dagi "Lending sahifa" bo'limidan shu endpointlar orqali
 * jadval, taomlar, o'qituvchilar va matnli bloklarni tahrirlaydi/qo'shadi.
 * Kontent endi har bir tashkilotga tegishli bo'lsa ham, bu panel hamon
 * BITTA ("bayroqdor") tashkilotni ko'rsatadi — tashkilot tanlash bu yerga
 * qo'shilmagan, qarang: LandingService.resolveDefaultOrganizationId.
 */
@ApiBearerAuth()
@ApiTags("Platform Landing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform/landing")
export class LandingAdminController {
  constructor(private readonly landingService: LandingService) {}

  // --- Jadval ---------------------------------------------------------------

  @Get("schedule")
  async listSchedule() {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.listScheduleItems(organizationId);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("schedule")
  async createScheduleItem(@Body() dto: CreateScheduleItemDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.createScheduleItem(organizationId, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("schedule/:id")
  async updateScheduleItem(@Param("id") id: string, @Body() dto: UpdateScheduleItemDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.updateScheduleItem(organizationId, id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete("schedule/:id")
  async deleteScheduleItem(@Param("id") id: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.deleteScheduleItem(organizationId, id);
  }

  // --- Taomlar ----------------------------------------------------------------

  @Get("meals")
  async listMeals() {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.listMeals(organizationId);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("meals")
  async createMeal(@Body() dto: CreateMealDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.createMeal(organizationId, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("meals/:id")
  async updateMeal(@Param("id") id: string, @Body() dto: UpdateMealDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.updateMeal(organizationId, id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete("meals/:id")
  async deleteMeal(@Param("id") id: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.deleteMeal(organizationId, id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("meals/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadMealPhoto(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.setMealPhoto(organizationId, id, `/uploads/landing/${file.filename}`);
  }

  // --- O'qituvchilar -------------------------------------------------------------

  @Get("teachers")
  async listTeachers() {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.listTeachers(organizationId);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("teachers")
  async createTeacher(@Body() dto: CreateTeacherDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.createTeacher(organizationId, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("teachers/:id")
  async updateTeacher(@Param("id") id: string, @Body() dto: UpdateTeacherDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.updateTeacher(organizationId, id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete("teachers/:id")
  async deleteTeacher(@Param("id") id: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.deleteTeacher(organizationId, id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("teachers/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadTeacherPhoto(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.setTeacherPhoto(organizationId, id, `/uploads/landing/${file.filename}`);
  }

  // --- Matnli bloklar ----------------------------------------------------------

  @Get("content-blocks")
  async listContentBlocks() {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.listContentBlocks(organizationId);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("content-blocks/:key")
  async upsertContentBlock(@Param("key") key: string, @Body() dto: UpdateContentBlockDto) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.upsertContentBlock(organizationId, key, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("content-blocks/:key/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadContentBlockPhoto(@Param("key") key: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    const organizationId = await this.landingService.resolveDefaultOrganizationId();
    return this.landingService.setContentBlockPhoto(organizationId, key, `/uploads/landing/${file.filename}`);
  }
}
