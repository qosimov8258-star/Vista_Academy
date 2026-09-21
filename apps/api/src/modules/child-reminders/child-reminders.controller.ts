import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { ChildRemindersService } from "./child-reminders.service";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { SetAllergiesDto } from "./dto/set-allergies.dto";

@ApiBearerAuth()
@ApiTags("Tenant Child Reminders")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class ChildRemindersController {
  constructor(private readonly service: ChildRemindersService) {}

  @Get("reminders")
  list(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Query("date") date: string,
    @Query("branchId") branchId?: string,
    @Query("childId") childId?: string,
  ) {
    return this.service.list(toTenantScope(user), { date, branchId, childId });
  }

  @Post("reminders")
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateReminderDto) {
    return this.service.create(toTenantScope(user), user.fullName, dto);
  }

  @Post("reminders/:id/done")
  setDone(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body("done") done?: boolean) {
    return this.service.setDone(toTenantScope(user), user.fullName, id, done !== false);
  }

  @Delete("reminders/:id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.remove(toTenantScope(user), id);
  }

  /** Tarbiyachi o'z guruhidagi bolaning allergiyasini yozadi — Ovqatlanish sahifasida oshpazga ham ko'rinadi. */
  @Put("children/:id/allergies")
  setAllergies(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: SetAllergiesDto) {
    return this.service.setAllergies(toTenantScope(user), id, dto);
  }
}
