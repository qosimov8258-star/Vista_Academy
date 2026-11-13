import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { ParentEngagementService } from "./parent-engagement.service";

/**
 * «Ota-onalar» bo'limi: ota-onalar kabinetdan qanchalik foydalanayotgani.
 * Super Admin, filial admini va administrator ko'radi; filial xodimi —
 * faqat o'z filiali. Super Admin `branchId` bilan bitta filialni tanlaydi.
 */
@ApiBearerAuth()
@ApiTags("Parent Engagement")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/parent-engagement")
export class ParentEngagementController {
  constructor(private readonly service: ParentEngagementService) {}

  @Get()
  overview(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId?: string) {
    return this.service.overview(user, branchId);
  }

  @Get(":guardianId")
  detail(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("guardianId", ParseUUIDPipe) guardianId: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.service.detail(user, guardianId, branchId);
  }
}
