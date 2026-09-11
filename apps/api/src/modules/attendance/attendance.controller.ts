import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { AttendanceService } from "./attendance.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { AttendanceRangeQueryDto } from "./dto/attendance-range-query.dto";

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

  /** So'nggi kunlar bo'yicha kunlik statistika (filial darajasida). */
  @Get("summary")
  rangeSummary(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: AttendanceRangeQueryDto) {
    return this.attendanceService.rangeSummary(toTenantScope(user), query);
  }

  /** Ketma-ket 3+ kun kelmagan yoki to'lov muddati o'tgan-va-bugun kelmagan bolalar. */
  @Get("chronic-absences")
  chronicAbsences(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId: string | undefined) {
    return this.attendanceService.chronicAbsenceFlags(toTenantScope(user), branchId);
  }

  @Post()
  mark(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(toTenantScope(user), dto);
  }
}
