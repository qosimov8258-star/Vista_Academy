import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CoinsService } from "./coins.service";
import { CoinsQueryDto } from "./dto/coins-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Coins")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/coins")
export class CoinsController {
  constructor(private readonly coinsService: CoinsService) {}

  @Get("children")
  listChildBalances(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: CoinsQueryDto) {
    return this.coinsService.listChildBalances(toTenantScope(user), query);
  }

  @Get("children/:childId/transactions")
  listTransactions(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("childId") childId: string) {
    return this.coinsService.listTransactions(toTenantScope(user), childId);
  }
}
