import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { LandingService } from "./landing.service";
import { CreateLandingApplicationDto } from "./dto/create-landing-application.dto";
import { PublicFormThrottle } from "../../common/throttle";

/**
 * Lending sahifa (landing-web) uchun ochiq ma'lumot — sayt tashrif buyuruvchi
 * hali tizimga kirmagan, shuning uchun token talab qilinmaydi. Kontent
 * (jadval, taomlar va h.k.) faqat o'qiladi — yozish platform-web orqali
 * (LandingAdminController). Yagona istisno — pastdagi `applications`:
 * tashrif buyuruvchi "Ariza qoldirish" formasini shu yerdan yuboradi.
 */
@ApiTags("Public Landing")
@Public()
@Controller("app/landing")
export class PublicLandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get("schedule")
  listSchedule() {
    return this.landingService.listScheduleItems();
  }

  @Get("meals")
  listMeals() {
    return this.landingService.listMeals();
  }

  @Get("teachers")
  listTeachers() {
    return this.landingService.listTeachers();
  }

  @Get("groups")
  listGroups() {
    return this.landingService.listGroups();
  }

  @Get("content-blocks")
  listContentBlocks() {
    return this.landingService.listContentBlocks();
  }

  @Get("content-blocks/:key")
  getContentBlock(@Param("key") key: string) {
    return this.landingService.getContentBlock(key);
  }

  /**
   * `organizationSlug` yuborilmasa, tashkilot so'rovning Origin (yo'q bo'lsa
   * Referer) hostidan aniqlanadi — har bir bog'chaning platform panelida
   * kiritilgan "Veb-sayt" domeni shu bilan solishtiriladi. Shunday qilib
   * mustaqil lending saytlar (masalan Vista-Academy-web) hech qanday
   * qo'shimcha sozlamasiz to'g'ri bog'chaga ariza yuboradi.
   */
  @PublicFormThrottle()
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
