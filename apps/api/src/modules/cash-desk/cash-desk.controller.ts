import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CashDeskService } from "./cash-desk.service";
import { CloseCashDto, CreateExpenseDto } from "./dto/cash-desk.dto";

@ApiBearerAuth()
@ApiTags("Tenant Cash Desk")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/cash")
export class CashDeskController {
  constructor(private readonly service: CashDeskService) {}

  @Get("day")
  day(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.day(toTenantScope(user), date);
  }

  @Post("expenses")
  addExpense(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.service.addExpense(toTenantScope(user), user.fullName, dto);
  }

  @Delete("expenses/:id")
  removeExpense(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.removeExpense(toTenantScope(user), id);
  }

  @Post("close")
  close(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CloseCashDto) {
    return this.service.close(toTenantScope(user), user.fullName, dto);
  }

  @Get("debtors")
  debtors(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.service.debtors(toTenantScope(user));
  }

  @Post("debtors/:childId/remind")
  remind(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("childId") childId: string) {
    return this.service.remind(toTenantScope(user), user.id, childId);
  }

  @Get("payables/:groupId")
  payables(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("groupId") groupId: string) {
    return this.service.payables(toTenantScope(user), groupId);
  }

  @Get("groups")
  groups(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("period") period: string) {
    return this.service.groups(toTenantScope(user), period);
  }

  @Get("groups/:groupId")
  groupChildren(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("groupId") groupId: string, @Query("period") period: string) {
    return this.service.groupChildren(toTenantScope(user), groupId, period);
  }

  @Get("report")
  report(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("month") month: string) {
    return this.service.report(toTenantScope(user), month);
  }
}
