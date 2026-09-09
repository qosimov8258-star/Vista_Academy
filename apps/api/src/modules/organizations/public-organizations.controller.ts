import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { OrganizationsService } from "./organizations.service";

/**
 * Kirish sahifasi uchun ochiq ma'lumot: tashkilotning nomi. Foydalanuvchi
 * hali tizimga kirmagan, shuning uchun token talab qilinmaydi. Faqat nom va
 * slug qaytadi — boshqa hech narsa ochilmaydi.
 */
@ApiTags("Tenant Organization")
@Public()
@Controller("app/organizations")
export class PublicOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get("by-slug/:slug")
  async findBySlug(@Param("slug") slug: string) {
    const organization = await this.organizationsService.findPublicBySlug(slug);
    if (!organization) {
      throw new NotFoundException("Tashkilot topilmadi");
    }
    return organization;
  }
}
