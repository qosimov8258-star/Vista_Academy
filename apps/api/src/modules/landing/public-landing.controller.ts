import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { LandingService } from "./landing.service";

/**
 * Lending sahifa (landing-web) uchun ochiq ma'lumot — sayt tashrif buyuruvchi
 * hali tizimga kirmagan, shuning uchun token talab qilinmaydi. Faqat
 * o'qish; yozish faqat platform-web orqali (LandingAdminController).
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

  @Get("content-blocks/:key")
  getContentBlock(@Param("key") key: string) {
    return this.landingService.getContentBlock(key);
  }
}
