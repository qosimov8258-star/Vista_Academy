import { mkdirSync } from "fs";
import { extname } from "path";
import { randomUUID } from "crypto";
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
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { LANDING_UPLOAD_DIR } from "../../common/constants/uploads";
import { LandingService } from "./landing.service";
import { CreateScheduleItemDto } from "./dto/create-schedule-item.dto";
import { UpdateScheduleItemDto } from "./dto/update-schedule-item.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
import { UpdateTeacherDto } from "./dto/update-teacher.dto";
import { UpdateContentBlockDto } from "./dto/update-content-block.dto";

const PHOTO_MIME_PATTERN = /^image\/(jpeg|png|webp|gif)$/;
const PHOTO_MAX_SIZE = 5 * 1024 * 1024;

const photoUploadInterceptor = () =>
  FileInterceptor("file", {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(LANDING_UPLOAD_DIR, { recursive: true });
        cb(null, LANDING_UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname) || ".jpg"}`);
      },
    }),
    limits: { fileSize: PHOTO_MAX_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!PHOTO_MIME_PATTERN.test(file.mimetype)) {
        cb(new BadRequestException("Faqat rasm fayllari qabul qilinadi (jpeg, png, webp, gif)"), false);
        return;
      }
      cb(null, true);
    },
  });

/**
 * Lending sahifa (landing-web) kontentini boshqarish — Platform Super Admin
 * platform-web'dagi "Lending sahifa" bo'limidan shu endpointlar orqali
 * jadval, taomlar, o'qituvchilar va matnli bloklarni tahrirlaydi/qo'shadi.
 */
@ApiBearerAuth()
@ApiTags("Platform Landing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform/landing")
export class LandingAdminController {
  constructor(private readonly landingService: LandingService) {}

  // --- Jadval ---------------------------------------------------------------

  @Get("schedule")
  listSchedule() {
    return this.landingService.listScheduleItems();
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("schedule")
  createScheduleItem(@Body() dto: CreateScheduleItemDto) {
    return this.landingService.createScheduleItem(dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("schedule/:id")
  updateScheduleItem(@Param("id") id: string, @Body() dto: UpdateScheduleItemDto) {
    return this.landingService.updateScheduleItem(id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete("schedule/:id")
  deleteScheduleItem(@Param("id") id: string) {
    return this.landingService.deleteScheduleItem(id);
  }

  // --- Taomlar ----------------------------------------------------------------

  @Get("meals")
  listMeals() {
    return this.landingService.listMeals();
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("meals")
  createMeal(@Body() dto: CreateMealDto) {
    return this.landingService.createMeal(dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("meals/:id")
  updateMeal(@Param("id") id: string, @Body() dto: UpdateMealDto) {
    return this.landingService.updateMeal(id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete("meals/:id")
  deleteMeal(@Param("id") id: string) {
    return this.landingService.deleteMeal(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("meals/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(photoUploadInterceptor())
  async uploadMealPhoto(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setMealPhoto(id, `/uploads/landing/${file.filename}`);
  }

  // --- O'qituvchilar -------------------------------------------------------------

  @Get("teachers")
  listTeachers() {
    return this.landingService.listTeachers();
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("teachers")
  createTeacher(@Body() dto: CreateTeacherDto) {
    return this.landingService.createTeacher(dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("teachers/:id")
  updateTeacher(@Param("id") id: string, @Body() dto: UpdateTeacherDto) {
    return this.landingService.updateTeacher(id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Delete("teachers/:id")
  deleteTeacher(@Param("id") id: string) {
    return this.landingService.deleteTeacher(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("teachers/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(photoUploadInterceptor())
  async uploadTeacherPhoto(@Param("id") id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setTeacherPhoto(id, `/uploads/landing/${file.filename}`);
  }

  // --- Matnli bloklar ----------------------------------------------------------

  @Get("content-blocks")
  listContentBlocks() {
    return this.landingService.listContentBlocks();
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("content-blocks/:key")
  upsertContentBlock(@Param("key") key: string, @Body() dto: UpdateContentBlockDto) {
    return this.landingService.upsertContentBlock(key, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post("content-blocks/:key/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(photoUploadInterceptor())
  async uploadContentBlockPhoto(@Param("key") key: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setContentBlockPhoto(key, `/uploads/landing/${file.filename}`);
  }
}
