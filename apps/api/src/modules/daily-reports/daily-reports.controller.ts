import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { DailyReportsService } from "./daily-reports.service";
import { UpsertDailyReportDto } from "./dto/upsert-daily-report.dto";
import { DailyReportQueryDto } from "./dto/daily-report-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Daily Reports")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class DailyReportsController {
  constructor(private readonly dailyReportsService: DailyReportsService) {}

  @Get("daily-reports")
  findByBranchAndDate(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: DailyReportQueryDto) {
    return this.dailyReportsService.findByBranchAndDate(toTenantScope(user), query);
  }

  @Post("daily-reports")
  upsert(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpsertDailyReportDto) {
    return this.dailyReportsService.upsert(toTenantScope(user), dto);
  }

  @Get("children/:id/daily-reports")
  findByChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.dailyReportsService.findByChild(toTenantScope(user), id);
  }
}
