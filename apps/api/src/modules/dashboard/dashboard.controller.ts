import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

@ApiBearerAuth()
@ApiTags("Platform Dashboard")
@UseGuards(JwtAuthGuard)
@Controller("platform/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary() {
    return this.dashboardService.getSummary();
  }

  /** Kun/Hafta/Oy/Yil bo'yicha KPI'lar, oylik tushum, muddati tugayotgan obunalar. */
  @Get("analytics")
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.dashboardService.getAnalytics(query.period ?? "month");
  }
}
