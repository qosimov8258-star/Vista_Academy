import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { AttendanceService } from "./attendance.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Attendance")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  findByBranchAndDate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.findByBranchAndDate(toTenantScope(user), query);
  }

  @Post()
  mark(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(toTenantScope(user), dto);
  }
}
