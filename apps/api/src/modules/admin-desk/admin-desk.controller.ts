import { Body, Controller, Delete, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { AdminDeskService } from "./admin-desk.service";
import { BroadcastDto, CallDoneDto, MarkPickupDto } from "./dto/admin-desk.dto";

@ApiBearerAuth()
@ApiTags("Tenant Admin Desk")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/desk")
export class AdminDeskController {
  constructor(private readonly service: AdminDeskService) {}

  @Get("calls")
  calls(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.calls(toTenantScope(user), date);
  }

  @Post("calls/done")
  callDone(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CallDoneDto) {
    return this.service.callDone(toTenantScope(user), user.fullName, dto);
  }

  @Post("calls/undo")
  callUndo(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CallDoneDto) {
    return this.service.callUndo(toTenantScope(user), dto);
  }

  @Get("board")
  board(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.board(toTenantScope(user), date);
  }

  @Get("pickups")
  pickups(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.pickups(toTenantScope(user), date);
  }

  @Post("pickups")
  markPickup(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: MarkPickupDto) {
    return this.service.markPickup(toTenantScope(user), user.fullName, dto);
  }

  @Delete("pickups")
  undoPickup(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("childId") childId: string, @Query("date") date: string) {
    return this.service.undoPickup(toTenantScope(user), childId, date);
  }

  @Get("weekly")
  weekly(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("from") from?: string) {
    return this.service.weekly(toTenantScope(user), from);
  }

  @Post("broadcast")
  broadcast(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: BroadcastDto) {
    return this.service.broadcast(toTenantScope(user), user.id, dto);
  }
}
