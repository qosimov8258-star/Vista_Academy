import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { LessonScheduleService } from "./lesson-schedule.service";
import { CreateLessonScheduleDto } from "./dto/create-lesson-schedule.dto";
import { UpdateLessonScheduleDto } from "./dto/update-lesson-schedule.dto";
import { LessonScheduleQueryDto } from "./dto/lesson-schedule-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Lesson Schedule")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/lesson-schedules")
export class LessonScheduleController {
  constructor(private readonly lessonScheduleService: LessonScheduleService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: LessonScheduleQueryDto) {
    return this.lessonScheduleService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateLessonScheduleDto) {
    return this.lessonScheduleService.create(toTenantScope(user), dto);
  }

  @Patch(":id")
  update(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateLessonScheduleDto) {
    return this.lessonScheduleService.update(toTenantScope(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.lessonScheduleService.remove(toTenantScope(user), id);
  }
}
