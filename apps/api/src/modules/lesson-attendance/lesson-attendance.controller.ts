import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { LessonAttendanceService } from "./lesson-attendance.service";
import { LessonAttendanceDayQueryDto } from "./dto/lesson-attendance-day-query.dto";
import { MarkLessonAttendanceDto } from "./dto/mark-lesson-attendance.dto";
import { MyLessonsQueryDto } from "./dto/lesson-attendance-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Lesson Attendance")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/lesson-attendance")
export class LessonAttendanceController {
  constructor(private readonly lessonAttendanceService: LessonAttendanceService) {}

  @Get("my-lessons")
  myLessons(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: MyLessonsQueryDto) {
    return this.lessonAttendanceService.myLessons(toTenantScope(user), query);
  }

  @Get()
  findByLesson(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: LessonAttendanceDayQueryDto) {
    return this.lessonAttendanceService.findByLesson(toTenantScope(user), query);
  }

  @Post()
  mark(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkLessonAttendanceDto) {
    return this.lessonAttendanceService.mark(toTenantScope(user), dto);
  }
}
