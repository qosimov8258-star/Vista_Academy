import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { TenantDashboardService } from "./tenant-dashboard.service";

@ApiBearerAuth()
@ApiTags("Tenant Dashboard")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/dashboard")
export class TenantDashboardController {
  constructor(private readonly tenantDashboardService: TenantDashboardService) {}

  @Get("summary")
  summary(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId?: string) {
    const scope = toTenantScope(user);
    // NETWORK_ADMIN has no fixed branch, so they may request one branch's
    // numbers explicitly (e.g. from a per-branch dashboard view). Branch-scoped
    // roles already have a fixed scope.branchId and this param is ignored for them.
    const effectiveScope = user.role === "NETWORK_ADMIN" && branchId ? { ...scope, branchId } : scope;
    return this.tenantDashboardService.summary(effectiveScope);
  }

  /** Bitta filial bo'yicha to'liq hisobot — Super Adminning filiallar sahifasidan ochiladi. */
  @Get("branch-report")
  branchReport(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId: string) {
    return this.tenantDashboardService.branchReport(toTenantScope(user), branchId);
  }
}
