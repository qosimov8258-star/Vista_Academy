import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { SubscriptionBillingService } from "./subscription-billing.service";
import { ExtendSubscriptionDto } from "./dto/extend-subscription.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole, SubscriptionStatus } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { SubscriptionsService } from "./subscriptions.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { ChangePlanDto } from "./dto/change-plan.dto";

@ApiBearerAuth()
@ApiTags("Platform Subscriptions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
@Controller("platform/subscriptions")
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly billing: SubscriptionBillingService,
  ) {}

  /** Obunani N oyga uzaytirish — hamyondan yechib yoki bepul. */
  @Post("organization/:organizationId/extend")
  extend(
    @Param("organizationId") organizationId: string,
    @Body() dto: ExtendSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billing.extend(organizationId, dto.months, dto.charge, user.id);
  }

  @Get()
  findAll() {
    return this.subscriptionsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto);
  }

  @Patch("organization/:organizationId/plan")
  changePlan(@Param("organizationId") organizationId: string, @Body() dto: ChangePlanDto) {
    return this.subscriptionsService.changePlan(organizationId, dto);
  }

  @Patch("organization/:organizationId/suspend")
  suspend(@Param("organizationId") organizationId: string) {
    return this.subscriptionsService.setStatus(organizationId, SubscriptionStatus.SUSPENDED);
  }

  @Patch("organization/:organizationId/activate")
  activate(@Param("organizationId") organizationId: string) {
    return this.subscriptionsService.setStatus(organizationId, SubscriptionStatus.ACTIVE);
  }
}
