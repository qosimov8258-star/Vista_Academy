import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { LandingService } from "./landing.service";
import { CreateLandingApplicationDto } from "./dto/create-landing-application.dto";

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

  @Post("applications")
  @HttpCode(HttpStatus.CREATED)
  createApplication(@Body() dto: CreateLandingApplicationDto) {
    return this.landingService.createApplication(dto);
  }
}
