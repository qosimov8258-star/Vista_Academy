import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { StaffAttendanceService } from "./staff-attendance.service";
import { MarkStaffAttendanceDto } from "./dto/mark-staff-attendance.dto";
import { StaffAttendanceQueryDto } from "./dto/staff-attendance-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Staff Attendance")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/staff-attendance")
export class StaffAttendanceController {
  constructor(private readonly staffAttendanceService: StaffAttendanceService) {}

  @Get()
  findByBranchAndDate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: StaffAttendanceQueryDto) {
    return this.staffAttendanceService.findByBranchAndDate(toTenantScope(user), query);
  }

  @Post()
  mark(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkStaffAttendanceDto) {
    return this.staffAttendanceService.mark(toTenantScope(user), dto);
  }
}
