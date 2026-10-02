import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { LandingService } from "./landing.service";
import { CreateLandingApplicationDto } from "./dto/create-landing-application.dto";
import { PublicFormThrottle } from "../../common/throttle";
import {
  localizeContentBlock,
  localizeGroupStudent,
  localizeMeal,
  localizeScheduleItem,
  localizeTeacher,
  resolveLandingLocale,
} from "./landing-locale.util";

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

  @ApiQuery({ name: "locale", required: false, enum: ["uz", "ru", "en"] })
  @Get("schedule")
  async listSchedule(@Query("locale") localeParam?: string) {
    const locale = resolveLandingLocale(localeParam);
    const items = await this.landingService.listScheduleItems();
    return items.map((item) => localizeScheduleItem(item, locale));
  }

  @ApiQuery({ name: "locale", required: false, enum: ["uz", "ru", "en"] })
  @Get("meals")
  async listMeals(@Query("locale") localeParam?: string) {
    const locale = resolveLandingLocale(localeParam);
    const meals = await this.landingService.listMeals();
    return meals.map((meal) => localizeMeal(meal, locale));
  }

  @ApiQuery({ name: "locale", required: false, enum: ["uz", "ru", "en"] })
  @Get("teachers")
  async listTeachers(@Query("locale") localeParam?: string) {
    const locale = resolveLandingLocale(localeParam);
    const teachers = await this.landingService.listTeachers();
    return teachers.map((teacher) => localizeTeacher(teacher, locale));
  }

  @ApiQuery({ name: "locale", required: false, enum: ["uz", "ru", "en"] })
  @Get("groups")
  async listGroups(@Query("locale") localeParam?: string) {
    const locale = resolveLandingLocale(localeParam);
    const groups = await this.landingService.listGroups();
    return groups.map((group) => ({
      ...group,
      students: group.students.map((student) => localizeGroupStudent(student, locale)),
    }));
  }

  @ApiQuery({ name: "locale", required: false, enum: ["uz", "ru", "en"] })
  @Get("content-blocks")
  async listContentBlocks(@Query("locale") localeParam?: string) {
    const locale = resolveLandingLocale(localeParam);
    const blocks = await this.landingService.listContentBlocks();
    return blocks.map((block) => localizeContentBlock(block, locale));
  }

  @ApiQuery({ name: "locale", required: false, enum: ["uz", "ru", "en"] })
  @Get("content-blocks/:key")
  async getContentBlock(@Param("key") key: string, @Query("locale") localeParam?: string) {
    const locale = resolveLandingLocale(localeParam);
    const block = await this.landingService.getContentBlock(key);
    return localizeContentBlock(block, locale);
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
