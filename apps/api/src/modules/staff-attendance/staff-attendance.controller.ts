import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { StaffAttendanceService } from "./staff-attendance.service";
import { StaffAttendanceReportService } from "./staff-attendance-report.service";
import { DOCUMENT_MAX_SIZE, StaffAbsenceDocumentsService } from "./staff-absence-documents.service";
import type { ReportKind } from "../cash-desk/report-kit";
import { MarkStaffAttendanceDto } from "./dto/mark-staff-attendance.dto";
import { StaffAttendanceQueryDto } from "./dto/staff-attendance-query.dto";
import { StaffAttendanceSummaryQueryDto } from "./dto/staff-attendance-summary-query.dto";
import { LockStaffAttendanceDto } from "./dto/lock-staff-attendance.dto";
import { StaffAttendanceHistoryQueryDto } from "./dto/staff-attendance-history-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Staff Attendance")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/staff-attendance")
export class StaffAttendanceController {
  constructor(
    private readonly staffAttendanceService: StaffAttendanceService,
    private readonly report: StaffAttendanceReportService,
    private readonly documents: StaffAbsenceDocumentsService,
  ) {}

  /** Kelmagan kun(lar) uchun hujjat yuklash: multipart `file` + employeeId, dates (vergul bilan), kind, note */
  @Post("documents")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: DOCUMENT_MAX_SIZE } }))
  uploadDocument(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { employeeId?: string; dates?: string; kind?: string; note?: string },
  ) {
    return this.documents.upload(user, file, body);
  }

  /** Hujjatlar: xodimning oyi (`employeeId` + `period`) yoki filialning bir kuni (`date`) */
  @Get("documents")
  listDocuments(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("employeeId") employeeId?: string,
    @Query("period") period?: string,
    @Query("date") date?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.documents.list(user, { employeeId, period, date, branchId });
  }

  @Get("documents/:id/file")
  documentFile(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    return this.documents.sendFile(user, id, res);
  }

  @Delete("documents/:id")
  deleteDocument(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.remove(user, id);
  }

  /** Davomat hisoboti (Excel): kun, hafta, oy yoki to'liq davr — kirish/chiqish vaqtlari, tabel, Face ID voqealari */
  @Get("report")
  async reportFile(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("kind") kind: ReportKind,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.report.build(user, kind, from, to, branchId);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(file.buffer);
  }

  @Get()
  findByBranchAndDate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: StaffAttendanceQueryDto) {
    return this.staffAttendanceService.findByBranchAndDate(toTenantScope(user), query);
  }

  /** Oylik jamlanma: har xodim uchun kelgan/kelmagan kunlar soni. */
  @Get("summary")
  monthlySummary(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query() query: StaffAttendanceSummaryQueryDto,
  ) {
    return this.staffAttendanceService.monthlySummary(toTenantScope(user), query);
  }

  /** Oy davomida kelmagan/kasal/ta'til kunlari ro'yxati. */
  @Get("absences")
  absences(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: StaffAttendanceSummaryQueryDto) {
    return this.staffAttendanceService.absences(toTenantScope(user), query);
  }

  /** Bitta xodimning bir oylik kun-kun tarixi (kasbi + har kuni kelgan/kelmagani). */
  @Get("history")
  history(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: StaffAttendanceHistoryQueryDto) {
    return this.staffAttendanceService.employeeHistory(toTenantScope(user), query);
  }

  @Post()
  mark(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkStaffAttendanceDto) {
    return this.staffAttendanceService.mark(toTenantScope(user), dto);
  }

  /** Barcha xodim saqlangandan keyin chaqiriladi — kunni qulflab, keyingi o'zgartirishlarni to'sadi. */
  @Post("lock")
  lock(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: LockStaffAttendanceDto) {
    return this.staffAttendanceService.lockDay(toTenantScope(user), user.fullName, dto);
  }
}
