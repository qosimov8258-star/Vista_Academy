import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { R2Service } from "../storage/r2.service";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { AdminDeskService } from "./admin-desk.service";
import { CallDoneDto, MarkPickupDto } from "./dto/admin-desk.dto";

@ApiBearerAuth()
@ApiTags("Tenant Admin Desk")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/desk")
export class AdminDeskController {
  constructor(
    private readonly service: AdminDeskService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Qo'ng'iroq qilinayotgan bolaning surati (Face ID uchun qo'yilgani) — call
   * operator ham ko'radi, unga «Bolalar» bo'limi yopiq bo'lsa ham. Faqat o'z
   * filialidagi bola. Javob — rasmning o'zi (`{ success, data }` qobig'isiz).
   */
  @Get("children/:id/photo")
  @Header("Cache-Control", "private, max-age=300")
  async childPhoto(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const media = await this.service.childPhoto(toTenantScope(user), id);
    await sendMediaResponse(res, this.r2, media, "Bolaning surati yo'q");
  }

  @Get("calls")
  calls(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.calls(toTenantScope(user), date, user.disabledFeatures);
  }

  /** Oxirgi 30 kunda qo'ng'iroq qilingan (javob olingan): arizalar, qarzdorlar va kelmagan bolalar */
  @Get("calls/leads-called")
  calledLeads(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.service.calledLeads(toTenantScope(user), user.disabledFeatures);
  }

  @Post("calls/done")
  callDone(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CallDoneDto) {
    return this.service.callDone(toTenantScope(user), user.fullName, dto, user.disabledFeatures);
  }

  @Post("calls/undo")
  callUndo(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CallDoneDto) {
    return this.service.callUndo(toTenantScope(user), dto, user.disabledFeatures);
  }

  @Get("board")
  board(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("date") date: string) {
    return this.service.board(toTenantScope(user), date, user.disabledFeatures);
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

  /** Guruhlar kesimida bolalar surati: nechtasida bor, nechtasida yo'q. */
  @Get("photos")
  photos(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.service.photos(toTenantScope(user));
  }

  @Get("weekly")
  weekly(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query("from") from?: string) {
    return this.service.weekly(toTenantScope(user), from, user.disabledFeatures);
  }
}
