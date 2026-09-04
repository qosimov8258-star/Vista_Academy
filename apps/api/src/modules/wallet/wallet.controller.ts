import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { WalletService } from "./wallet.service";
import { TopUpWalletDto } from "./dto/top-up-wallet.dto";
import { AdjustWalletDto } from "./dto/adjust-wallet.dto";
import { AuthenticatedUser } from "../auth/auth.types";

@ApiBearerAuth()
@ApiTags("Platform Wallet")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
@Controller("platform/organizations/:organizationId/wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  get(@Param("organizationId") organizationId: string) {
    return this.walletService.getByOrganization(organizationId);
  }

  @Post("top-up")
  topUp(
    @Param("organizationId") organizationId: string,
    @Body() dto: TopUpWalletDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.walletService.topUp(organizationId, dto, user.id);
  }

  @Post("adjust")
  adjust(
    @Param("organizationId") organizationId: string,
    @Body() dto: AdjustWalletDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.walletService.adjust(organizationId, dto, user.id);
  }
}
