import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { EmployeeNotificationsService } from "./employee-notifications.service";
import { AllowChef } from "../iam/decorators/allow-chef.decorator";

@ApiBearerAuth()
@ApiTags("Tenant Employee Notifications")
@Public()
@UseGuards(TenantJwtAuthGuard)
@AllowChef()
@Controller("app/employee-notifications")
export class EmployeeNotificationsController {
  constructor(private readonly employeeNotificationsService: EmployeeNotificationsService) {}

  @Get()
  findMine(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.employeeNotificationsService.findMine(toTenantScope(user));
  }

  /** Admin qo'ng'iroqchasi: so'nggi 48 soatdagi ota-ona eslatmalari va «yo'lga chiqdim» xabarlari */
  @Get("parent-messages")
  parentMessages(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("branchId") branchId?: string) {
    return this.employeeNotificationsService.parentMessages(toTenantScope(user), branchId || undefined);
  }

  @Patch("read-all")
  markAllRead(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.employeeNotificationsService.markAllRead(toTenantScope(user));
  }

  @Patch(":id/read")
  markRead(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.employeeNotificationsService.markRead(toTenantScope(user), id);
  }
}
