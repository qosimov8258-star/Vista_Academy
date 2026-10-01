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
 * ("Lending sahifa" bo'limi). Har bir tashkilot faqat o'z kontentini
 * ko'radi/tahrirlaydi (organizationId bilan ajratilgan — LandingService).
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

  // --- O'z kontentini o'qish (sahifa ro'yxatlari) -------------------------------

  @Get("me/teachers")
  listMyTeachers(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.landingService.listTeachers(toTenantScope(user).organizationId);
  }

  @Get("me/meals")
  listMyMeals(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.landingService.listMeals(toTenantScope(user).organizationId);
  }

  @Get("me/groups")
  listMyGroups(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.landingService.listGroups(toTenantScope(user).organizationId);
  }

  @Get("me/content-blocks")
  listMyContentBlocks(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.landingService.listContentBlocks(toTenantScope(user).organizationId);
  }

  // --- O'qituvchilar -------------------------------------------------------------

  @Post("teachers")
  createTeacher(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateTeacherDto) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.createTeacher(scope.organizationId, dto);
  }

  @Patch("teachers/:id")
  updateTeacher(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.updateTeacher(scope.organizationId, id, dto);
  }

  @Delete("teachers/:id")
  deleteTeacher(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.deleteTeacher(scope.organizationId, id);
  }

  @Post("teachers/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadTeacherPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setTeacherPhoto(scope.organizationId, id, `/uploads/landing/${file.filename}`);
  }

  // --- Menu (taomlar) -----------------------------------------------------------

  @Post("meals")
  createMeal(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateMealDto) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.createMeal(scope.organizationId, dto);
  }

  @Patch("meals/:id")
  updateMeal(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateMealDto,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.updateMeal(scope.organizationId, id, dto);
  }

  @Delete("meals/:id")
  deleteMeal(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.deleteMeal(scope.organizationId, id);
  }

  @Post("meals/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadMealPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setMealPhoto(scope.organizationId, id, `/uploads/landing/${file.filename}`);
  }

  // --- Guruhlar ------------------------------------------------------------------

  @Post("groups")
  createGroup(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateGroupDto) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.createGroup(scope.organizationId, dto);
  }

  @Patch("groups/:id")
  updateGroup(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.updateGroup(scope.organizationId, id, dto);
  }

  @Delete("groups/:id")
  deleteGroup(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.deleteGroup(scope.organizationId, id);
  }

  @Post("groups/:id/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadGroupPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setGroupPhoto(scope.organizationId, id, `/uploads/landing/${file.filename}`);
  }

  @Post("groups/:id/photos")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async addGroupGalleryPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.addGroupPhoto(scope.organizationId, id, `/uploads/landing/${file.filename}`);
  }

  @Delete("groups/:id/photos/:photoId")
  deleteGroupGalleryPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("photoId") photoId: string,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.deleteGroupPhoto(scope.organizationId, id, photoId);
  }

  // --- Guruhdagi o'quvchilar -------------------------------------------------------

  @Post("groups/:id/students")
  createGroupStudent(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CreateGroupStudentDto,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.createGroupStudent(scope.organizationId, id, dto);
  }

  @Patch("groups/:id/students/:studentId")
  updateGroupStudent(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
    @Body() dto: UpdateGroupStudentDto,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.updateGroupStudent(scope.organizationId, id, studentId, dto);
  }

  @Delete("groups/:id/students/:studentId")
  deleteGroupStudent(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.deleteGroupStudent(scope.organizationId, id, studentId);
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
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setGroupStudentPhoto(scope.organizationId, id, studentId, `/uploads/landing/${file.filename}`);
  }

  // --- Matnli bloklar (maxsus ko'rsatilgan o'qituvchilar) ------------------------

  @Patch("content-blocks/:key")
  upsertContentBlock(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("key") key: string,
    @Body() dto: UpdateContentBlockDto,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    return this.landingService.upsertContentBlock(scope.organizationId, key, dto);
  }

  @Post("content-blocks/:key/photo")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(landingPhotoUploadInterceptor())
  async uploadContentBlockPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("key") key: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const scope = toTenantScope(user);
    requireOperationalScope(scope);
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    return this.landingService.setContentBlockPhoto(scope.organizationId, key, `/uploads/landing/${file.filename}`);
  }
}
