import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { LandingService } from "./landing.service";
import { landingPhotoUploadInterceptor } from "./landing-upload.util";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { CreateTeacherDto } from "./dto/create-teacher.dto";
import { UpdateTeacherDto } from "./dto/update-teacher.dto";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";
import { CreateGroupStudentDto } from "./dto/create-group-student.dto";
import { UpdateGroupStudentDto } from "./dto/update-group-student.dto";
import { UpdateContentBlockDto } from "./dto/update-content-block.dto";

/**
 * Lending sahifa (landing-web) kontentini boshqarish — bog'cha panelidan
 * ("Lending sahifa" bo'limi). Landing-web bitta umumiy marketing sayt bo'lsa
 * ham, bu tashkilotda uni filial admini/administrator shu yerdan tahrirlaydi;
 * o'qish (`GET`) hamon `PublicLandingController` orqali ochiq.
 * Ruxsat qoidasi operatsion modullar bilan bir xil: Super Admin faqat
 * kuzatadi, moliyachi va o'qituvchi bu yerga kirmaydi.
 */
@ApiBearerAuth()
@ApiTags("Tenant Landing")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/landing")
export class TenantLandingController {
  constructor(private readonly landingService: LandingService) {}

  // --- O'qituvchilar -------------------------------------------------------------

  @Post("teachers")
  createTeacher(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateTeacherDto) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.createTeacher(dto);
  }

  @Patch("teachers/:id")
  updateTeacher(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.updateTeacher(id, dto);
  }

  @Delete("teachers/:id")
  deleteTeacher(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.deleteTeacher(id);
  }

  @Post("teachers/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadTeacherPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    requireOperationalScope(toTenantScope(user));
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setTeacherPhoto(id, `/uploads/landing/${file.filename}`);
  }

  // --- Menu (taomlar) -----------------------------------------------------------

  @Post("meals")
  createMeal(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateMealDto) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.createMeal(dto);
  }

  @Patch("meals/:id")
  updateMeal(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateMealDto,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.updateMeal(id, dto);
  }

  @Delete("meals/:id")
  deleteMeal(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.deleteMeal(id);
  }

  @Post("meals/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadMealPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    requireOperationalScope(toTenantScope(user));
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setMealPhoto(id, `/uploads/landing/${file.filename}`);
  }

  // --- Guruhlar ------------------------------------------------------------------

  @Post("groups")
  createGroup(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateGroupDto) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.createGroup(dto);
  }

  @Patch("groups/:id")
  updateGroup(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.updateGroup(id, dto);
  }

  @Delete("groups/:id")
  deleteGroup(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.deleteGroup(id);
  }

  @Post("groups/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadGroupPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    requireOperationalScope(toTenantScope(user));
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setGroupPhoto(id, `/uploads/landing/${file.filename}`);
  }

  @Post("groups/:id/photos")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async addGroupGalleryPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    requireOperationalScope(toTenantScope(user));
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.addGroupPhoto(id, `/uploads/landing/${file.filename}`);
  }

  @Delete("groups/:id/photos/:photoId")
  deleteGroupGalleryPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("photoId") photoId: string,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.deleteGroupPhoto(id, photoId);
  }

  // --- Guruhdagi o'quvchilar -------------------------------------------------------

  @Post("groups/:id/students")
  createGroupStudent(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CreateGroupStudentDto,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.createGroupStudent(id, dto);
  }

  @Patch("groups/:id/students/:studentId")
  updateGroupStudent(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
    @Body() dto: UpdateGroupStudentDto,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.updateGroupStudent(id, studentId, dto);
  }

  @Delete("groups/:id/students/:studentId")
  deleteGroupStudent(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.deleteGroupStudent(id, studentId);
  }

  @Post("groups/:id/students/:studentId/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadGroupStudentPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    requireOperationalScope(toTenantScope(user));
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setGroupStudentPhoto(id, studentId, `/uploads/landing/${file.filename}`);
  }

  // --- Matnli bloklar (maxsus ko'rsatilgan o'qituvchilar) ------------------------

  @Patch("content-blocks/:key")
  upsertContentBlock(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("key") key: string,
    @Body() dto: UpdateContentBlockDto,
  ) {
    requireOperationalScope(toTenantScope(user));
    return this.landingService.upsertContentBlock(key, dto);
  }

  @Post("content-blocks/:key/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadContentBlockPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("key") key: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    requireOperationalScope(toTenantScope(user));
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setContentBlockPhoto(key, `/uploads/landing/${file.filename}`);
  }
}
