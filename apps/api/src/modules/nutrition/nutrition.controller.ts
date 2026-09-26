import { Body, Controller, Delete, Get, Header, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { NutritionService } from "./nutrition.service";
import { UpsertMenuEntryDto } from "./dto/upsert-menu-entry.dto";
import { MenuQueryDto } from "./dto/menu-query.dto";
import { UploadMenuPhotoDto } from "./dto/upload-menu-photo.dto";
import { MenuPhotosQueryDto } from "./dto/menu-photos-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Nutrition")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/menu")
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get()
  findRange(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: MenuQueryDto) {
    return this.nutritionService.findRange(toTenantScope(user), query);
  }

  @Get("today-summary")
  todaySummary(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("date") date: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.nutritionService.todaySummary(toTenantScope(user), { date, branchId });
  }

  @Post()
  upsert(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpsertMenuEntryDto) {
    return this.nutritionService.upsert(toTenantScope(user), dto);
  }

  /** Kunning taom suratlari (faqat ro'yxat — suratning o'zi pastdagi yo'ldan) */
  @Get("photos")
  listPhotos(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: MenuPhotosQueryDto) {
    return this.nutritionService.listPhotos(toTenantScope(user), query);
  }

  @Post("photos")
  uploadPhoto(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UploadMenuPhotoDto) {
    return this.nutritionService.uploadPhoto(toTenantScope(user), dto);
  }

  @Delete("photos/:id")
  deletePhoto(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.nutritionService.deletePhoto(toTenantScope(user), id);
  }

  /**
   * Suratni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   * Surat o'zgarmaydi (yangisi yangi id oladi) — uzoq keshlash mumkin.
   */
  @Get("photos/:id/image")
  @Header("Cache-Control", "private, max-age=86400")
  async readPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const photo = await this.nutritionService.readPhoto(toTenantScope(user), id);
    res.setHeader("Content-Type", photo.mimeType);
    res.send(Buffer.from(photo.image));
  }
}
