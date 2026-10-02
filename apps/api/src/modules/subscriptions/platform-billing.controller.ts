import { Controller, Get, Header, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import type { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { PlatformBillingService } from "./platform-billing.service";
import { SubscriptionBillingService } from "./subscription-billing.service";
import { BillingTransactionsQueryDto, RenewalsQueryDto } from "./dto/billing-query.dto";

@ApiBearerAuth()
@ApiTags("Platform Billing")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
@Controller("platform/billing")
export class PlatformBillingController {
  constructor(
    private readonly billing: PlatformBillingService,
    private readonly subscriptionBilling: SubscriptionBillingService,
  ) {}

  @Get("overview")
  overview() {
    return this.billing.overview();
  }

  @Get("renewals")
  renewals(@Query() query: RenewalsQueryDto) {
    return this.billing.renewals(query.days);
  }

  @Get("transactions")
  transactions(@Query() query: BillingTransactionsQueryDto) {
    return this.billing.transactions(query);
  }

  /** Excel uchun CSV — javob `{ success, data }` qobig'iga o'ralmaydi. */
  @Get("transactions.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async transactionsCsv(@Query() query: BillingTransactionsQueryDto, @Res() res: Response) {
    const csv = await this.billing.transactionsCsv(query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="zeeron-hamyon-amallari-${date}.csv"`);
    res.send(csv);
  }

  /** Cron'ni kutmasdan hozir hisob-kitob qilish (muddati tugaganlar). */
  @Post("run")
  run() {
    return this.subscriptionBilling.runDue();
  }
}
