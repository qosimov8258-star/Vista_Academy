import { Controller, Get, Header, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { R2Service } from "../storage/r2.service";
import { OrganizationsService } from "./organizations.service";

/**
 * Kirish sahifasi uchun ochiq ma'lumot: tashkilotning nomi. Foydalanuvchi
 * hali tizimga kirmagan, shuning uchun token talab qilinmaydi. Faqat nom,
 * slug va logo qaytadi — boshqa hech narsa ochilmaydi.
 */
@ApiTags("Tenant Organization")
@Public()
@Controller("app/organizations")
export class PublicOrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly r2: R2Service,
  ) {}

  @Get("by-slug/:slug")
  async findBySlug(@Param("slug") slug: string) {
    const organization = await this.organizationsService.findPublicBySlug(slug);
    if (!organization) {
      throw new NotFoundException("Tashkilot topilmadi");
    }
    return organization;
  }

  /**
   * Bog'cha logosi (rasm). Kirish sahifasi va panel `<img src>` bilan oladi,
   * manzilga `?v=logoUpdatedAt` qo'shiladi — shuning uchun uzoq keshlanadi.
   */
  @Get("by-slug/:slug/logo")
  @Header("Cache-Control", "public, max-age=86400")
  async readLogo(@Param("slug") slug: string, @Res() res: Response) {
    const record = await this.organizationsService.readLogoBySlug(slug);
    await sendMediaResponse(
      res,
      this.r2,
      { key: record?.logoKey ?? null, bytes: record?.logo ?? null, mimeType: record?.logoMimeType ?? "image/png" },
      "Logo yo'q",
    );
  }
}
