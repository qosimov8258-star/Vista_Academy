import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { AttendanceService } from "./attendance.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import { AttendanceRangeQueryDto } from "./dto/attendance-range-query.dto";
import { RequestContactDto } from "./dto/request-contact.dto";

@ApiBearerAuth()
@ApiTags("Tenant Attendance")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("attendance")
  findByBranchAndDate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: AttendanceQueryDto) {
    return this.attendanceService.findByBranchAndDate(toTenantScope(user), query);
  }

  /** So'nggi kunlar bo'yicha kunlik statistika (filial darajasida). */
  @Get("attendance/summary")
  rangeSummary(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: AttendanceRangeQueryDto) {
    return this.attendanceService.rangeSummary(toTenantScope(user), query);
  }

  /** Ketma-ket 3+ kun kelmagan yoki to'lov muddati o'tgan-va-bugun kelmagan bolalar. */
  @Get("attendance/chronic-absences")
  chronicAbsences(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId: string | undefined) {
    return this.attendanceService.chronicAbsenceFlags(toTenantScope(user), branchId);
  }

  @Post("attendance")
  mark(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(toTenantScope(user), dto);
  }

  /** Tarbiyachi "Aloqaga chiqish" bosganda — administratorga bildirishnoma yaratadi. */
  @Post("attendance/request-contact")
  requestContact(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: RequestContactDto) {
    return this.attendanceService.requestContact(toTenantScope(user), dto);
  }

  /** Bola kabineti — shu yilgi davomat tarixi (statistika + kalendar uchun kunma-kun ro'yxat). */
  @Get("children/:id/attendance-history")
  childHistory(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Query("year") year: string | undefined,
  ) {
    return this.attendanceService.getChildHistory(toTenantScope(user), id, year ? Number(year) : undefined);
  }
}
