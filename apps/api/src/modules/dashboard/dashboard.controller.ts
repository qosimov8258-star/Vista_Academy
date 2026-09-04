import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

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
}
