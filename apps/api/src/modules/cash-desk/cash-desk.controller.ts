import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { sendMediaResponse } from "../../common/media-response";
import { R2Service } from "../storage/r2.service";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CashDeskService } from "./cash-desk.service";
import { PaymentsReportService, type ReportFormat, type ReportKind } from "./payments-report.service";
import { ExpensesReportService } from "./expenses-report.service";
import { CloseCashDto, CreateExpenseDto, UpdateExpenseDto } from "./dto/cash-desk.dto";

@ApiBearerAuth()
@ApiTags("Tenant Cash Desk")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/cash")
export class CashDeskController {
  constructor(
    private readonly service: CashDeskService,
    private readonly r2: R2Service,
    private readonly paymentsReport: PaymentsReportService,
    private readonly expensesReport: ExpensesReportService,
  ) {}

  /** To'lovlar hisoboti (Excel yoki PDF): kun, hafta, oy yoki to'liq davr */
  @Get("payments-report")
  async paymentsReportFile(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("kind") kind: ReportKind,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("format") format: ReportFormat,
    @Res() res: Response,
  ) {
    sendReport(res, await this.paymentsReport.build(user, kind, from, to, format));
  }

  /** Xarajatlar hisoboti (Excel yoki PDF): kun, hafta, oy yoki to'liq davr */
  @Get("expenses-report")
  async expensesReportFile(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("kind") kind: ReportKind,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("format") format: ReportFormat,
    @Res() res: Response,
  ) {
    sendReport(res, await this.expensesReport.build(user, kind, from, to, format));
  }

  @Get("day")
  day(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.day(toTenantScope(user), date);
  }

  /** Oy bo'yicha xarajatlar: jami, turkumlar, o'tgan oy bilan solishtirish va ro'yxat. */
  @Get("expenses")
  expenses(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("month") month: string) {
    return this.service.listExpenses(toTenantScope(user), month);
  }

  @Post("expenses")
  addExpense(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.service.addExpense(user, dto);
  }

  @Get("expenses/:id/receipt-image")
  @Header("Cache-Control", "private, max-age=60")
  async expenseImage(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Res() res: Response) {
    const record = await this.service.readExpenseImage(toTenantScope(user), id);
    await sendMediaResponse(res, this.r2, { key: record.imageKey, bytes: record.image, mimeType: record.mimeType }, "Chek surati yo'q");
  }

  @Patch("expenses/:id")
  updateExpense(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateExpenseDto) {
    return this.service.updateExpense(user, id, dto);
  }

  @Delete("expenses/:id")
  removeExpense(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.removeExpense(user, id);
  }

  @Post("close")
  close(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CloseCashDto) {
    return this.service.close(user, dto);
  }

  @Get("debtors")
  debtors(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.service.debtors(toTenantScope(user));
  }

  @Post("debtors/:childId/remind")
  remind(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("childId") childId: string) {
    return this.service.remind(toTenantScope(user), user.id, childId);
  }

  @Get("payables/:groupId")
  payables(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("groupId") groupId: string) {
    return this.service.payables(toTenantScope(user), groupId);
  }

  @Get("groups")
  groups(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("period") period: string) {
    return this.service.groups(toTenantScope(user), period);
  }

  /** Tanlangan oy bo'yicha filialdagi barcha bolalar holati (To'lovlar sahifasi va qidiruv uchun). */
  @Get("children")
  periodChildren(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("period") period: string) {
    return this.service.periodChildren(toTenantScope(user), period);
  }

  @Get("groups/:groupId")
  groupChildren(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("groupId") groupId: string, @Query("period") period: string) {
    return this.service.groupChildren(toTenantScope(user), groupId, period);
  }

  @Get("report")
  report(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("month") month: string) {
    return this.service.report(toTenantScope(user), month);
  }
}

function sendReport(res: Response, file: { buffer: Buffer; filename: string; contentType: string }) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
}
