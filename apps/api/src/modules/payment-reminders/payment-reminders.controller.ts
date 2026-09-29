import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { PaymentRemindersService } from "./payment-reminders.service";
import { UpdateReminderSettingsDto } from "./dto/update-reminder-settings.dto";

/**
 * To'lov eslatmasi sozlamalari — Moliya bo'limi ichida. `TenantJwtAuthGuard`
 * bilan himoyalangan, ruxsat qoidasi (Super Admin/filial admini/moliyachi)
 * service ichida tekshiriladi (`billing.controller.ts` naqshiga mos).
 */
@ApiBearerAuth()
@ApiTags("Tenant Payment Reminders")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/finance")
export class PaymentRemindersController {
  constructor(private readonly paymentRemindersService: PaymentRemindersService) {}

  @Get("reminder-settings")
  getSettings(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId?: string) {
    return this.paymentRemindersService.getOrCreateSettings(toTenantScope(user), branchId);
  }

  @Put("reminder-settings")
  updateSettings(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Body() dto: UpdateReminderSettingsDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.paymentRemindersService.updateSettings(toTenantScope(user), dto, branchId);
  }

  @Get("reminder-settings/unpaid-children")
  unpaidChildren(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId?: string) {
    return this.paymentRemindersService.listUnpaidChildren(toTenantScope(user), branchId);
  }
}
