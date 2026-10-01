import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { LandingService } from "./landing.service";
import { CreateLandingApplicationDto } from "./dto/create-landing-application.dto";

/**
 * Lending sahifa (landing-web) uchun ochiq ma'lumot — sayt tashrif buyuruvchi
 * hali tizimga kirmagan, shuning uchun token talab qilinmaydi. Kontent endi
 * har bir tashkilotga tegishli, lekin bu endpointlar hamon BITTA ("bayroqdor")
 * tashkilotni ko'rsatadi — qarang: LandingService.resolveDefaultOrganizationId.
 * Yozish — bog'cha panelidan (TenantLandingController). Yagona istisno —
 * pastdagi `applications`: tashrif buyuruvchi "Ariza qoldirish" formasini
 * shu yerdan yuboradi.
 */
@ApiTags("Public Landing")
@Public()
@Controller("app/landing")
export class PublicLandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get("schedule")
  async listSchedule(@Query("org") org?: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId(org);
    return this.landingService.listScheduleItems(organizationId);
  }

  @Get("meals")
  async listMeals(@Query("org") org?: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId(org);
    return this.landingService.listMeals(organizationId);
  }

  @Get("teachers")
  async listTeachers(@Query("org") org?: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId(org);
    return this.landingService.listTeachers(organizationId);
  }

  @Get("groups")
  async listGroups(@Query("org") org?: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId(org);
    return this.landingService.listGroups(organizationId);
  }

  @Get("content-blocks")
  async listContentBlocks(@Query("org") org?: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId(org);
    return this.landingService.listContentBlocks(organizationId);
  }

  @Get("content-blocks/:key")
  async getContentBlock(@Param("key") key: string, @Query("org") org?: string) {
    const organizationId = await this.landingService.resolveDefaultOrganizationId(org);
    return this.landingService.getContentBlock(organizationId, key);
  }

  /**
   * `organizationSlug` yuborilmasa, tashkilot so'rovning Origin (yo'q bo'lsa
   * Referer) hostidan aniqlanadi — har bir bog'chaning platform panelida
   * kiritilgan "Veb-sayt" domeni shu bilan solishtiriladi. Shunday qilib
   * mustaqil lending saytlar (masalan Vista-Academy-web) hech qanday
   * qo'shimcha sozlamasiz to'g'ri bog'chaga ariza yuboradi.
   */
  @Post("applications")
  @HttpCode(HttpStatus.CREATED)
  createApplication(
    @Body() dto: CreateLandingApplicationDto,
    @Headers("origin") origin: string | undefined,
    @Headers("referer") referer: string | undefined,
  ) {
    return this.landingService.createApplication(dto, origin || referer);
  }
}
