import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { HrService } from "./hr.service";
import { UpsertSalarySchemeDto } from "./dto/upsert-salary-scheme.dto";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { ShiftQueryDto } from "./dto/shift-query.dto";
import { GeneratePayrollDto } from "./dto/generate-payroll.dto";
import { PayrollQueryDto } from "./dto/payroll-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant HR / Payroll")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get("employees/:id/salary-scheme")
  getSalaryScheme(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.hrService.getSalaryScheme(toTenantScope(user), id);
  }

  @Post("employees/:id/salary-scheme")
  upsertSalaryScheme(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpsertSalarySchemeDto) {
    return this.hrService.upsertSalaryScheme(toTenantScope(user), id, dto);
  }

  @Get("shifts")
  listShifts(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: ShiftQueryDto) {
    return this.hrService.listShifts(toTenantScope(user), query);
  }

  @Post("shifts")
  createShift(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateShiftDto) {
    return this.hrService.createShift(toTenantScope(user), dto);
  }

  /** Ish haqi jamlanmasi: umumiy fond va filial kesimi. */
  @Get("payroll/summary")
  payrollSummary(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: PayrollQueryDto) {
    return this.hrService.payrollSummary(toTenantScope(user), query);
  }

  @Get("payroll")
  listPayroll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: PayrollQueryDto) {
    return this.hrService.listPayroll(toTenantScope(user), query);
  }

  @Post("payroll")
  generatePayroll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: GeneratePayrollDto) {
    return this.hrService.generatePayroll(toTenantScope(user), dto);
  }

  @Patch("payroll/:id/mark-paid")
  markPayrollPaid(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.hrService.markPayrollPaid(toTenantScope(user), id);
  }
}
