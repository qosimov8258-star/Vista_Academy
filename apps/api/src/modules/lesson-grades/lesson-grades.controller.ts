import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { LessonGradesService } from "./lesson-grades.service";
import { UpsertLessonGradeDto } from "./dto/upsert-lesson-grade.dto";
import { LessonGradeQueryDto } from "./dto/lesson-grade-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Lesson Grades")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class LessonGradesController {
  constructor(private readonly lessonGradesService: LessonGradesService) {}

  @Get("lesson-grades")
  findByGroupAndDate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: LessonGradeQueryDto) {
    return this.lessonGradesService.findByGroupAndDate(toTenantScope(user), query);
  }

  @Post("lesson-grades")
  upsert(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpsertLessonGradeDto) {
    return this.lessonGradesService.upsert(toTenantScope(user), dto);
  }

  @Get("children/:id/lesson-grades")
  findByChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.lessonGradesService.findByChild(toTenantScope(user), id);
  }
}
