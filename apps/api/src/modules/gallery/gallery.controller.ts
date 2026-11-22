import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CurrentParent } from "../parent/decorators/current-parent.decorator";
import { ParentJwtAuthGuard } from "../parent/guards/parent-jwt-auth.guard";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { R2Service } from "../storage/r2.service";
import { CreateGalleryItemDto, GALLERY_MAX_IMAGES, GalleryQueryDto, UpdateGalleryItemDto } from "./dto/gallery.dto";
import { GalleryService } from "./gallery.service";

/** Xodimlar: bolalar ishlarini yuklash */
@ApiBearerAuth()
@ApiTags("Tenant Gallery")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/gallery")
export class GalleryController {
  constructor(
    private readonly gallery: GalleryService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  list(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: GalleryQueryDto) {
    return this.gallery.list(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateGalleryItemDto) {
    return this.gallery.create(toTenantScope(user), dto);
  }

  @Patch(":id")
  update(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateGalleryItemDto) {
    return this.gallery.update(toTenantScope(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.gallery.remove(toTenantScope(user), id);
  }

  @Get(":id/image")
  @Header("Cache-Control", "private, max-age=86400")
  async image(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("n") n: string | undefined,
    @Res() res: Response,
  ) {
    const media = await this.gallery.imageForStaff(toTenantScope(user), id, imageIndex(n));
    await sendMediaResponse(res, this.r2, media, "Rasm topilmadi");
  }
}

/** Ota-onalar: filialdagi bolalar ishlari va «Yoqdi» */
@ApiTags("Parent Gallery")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent/gallery")
export class ParentGalleryController {
  constructor(
    private readonly gallery: GalleryService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  list(@CurrentParent() parent: AuthenticatedParent) {
    return this.gallery.listForParent(parent);
  }

  @Post(":id/like")
  like(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string) {
    return this.gallery.toggleLike(parent, id);
  }

  @Get(":id/image")
  @Header("Cache-Control", "private, max-age=86400")
  async image(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("n") n: string | undefined,
    @Res() res: Response,
  ) {
    const media = await this.gallery.imageForParent(parent, id, imageIndex(n));
    await sendMediaResponse(res, this.r2, media, "Rasm topilmadi");
  }
}

/** `?n=` — ishning nechanchi rasmi (0 — birinchisi); noto'g'ri bo'lsa birinchisi */
function imageIndex(n: string | undefined): number {
  const index = Number(n);
  return Number.isInteger(index) && index >= 0 && index < GALLERY_MAX_IMAGES ? index : 0;
}
