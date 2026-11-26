import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { sendMediaResponse } from "../../common/media-response";
import { R2Service } from "../storage/r2.service";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { AllowChef } from "../iam/decorators/allow-chef.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { ParentJwtAuthGuard } from "../parent/guards/parent-jwt-auth.guard";
import { CurrentParent } from "../parent/decorators/current-parent.decorator";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { BroadcastsService } from "./broadcasts.service";
import { BroadcastListQueryDto, BroadcastTargetDto, CreateBroadcastDto } from "./dto/broadcast.dto";

/** Rahbariyat: yuborish va tarix. Xodim: o'ziga kelgan xabarlar (`inbox`). */
@ApiBearerAuth()
@ApiTags("Tenant Broadcasts")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/broadcasts")
export class BroadcastsController {
  constructor(
    private readonly service: BroadcastsService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  list(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: BroadcastListQueryDto) {
    // branchId DTO ichida: alohida @Query("branchId") validatsiyadan o'tmay 400 qaytarardi
    return this.service.list(user, query, query.branchId);
  }

  /** Yuborishdan oldin: necha kishiga boradi */
  @Post("preview")
  @HttpCode(HttpStatus.OK)
  preview(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: BroadcastTargetDto) {
    return this.service.preview(user, dto);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateBroadcastDto) {
    return this.service.create(user, dto);
  }

  // `inbox` yo'llari `:id` dan oldin — aks holda "inbox" id deb tushuniladi
  @Get("inbox")
  @AllowChef()
  inbox(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.service.employeeInbox(user);
  }

  @Patch("inbox/read-all")
  @AllowChef()
  inboxReadAll(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.service.employeeMarkAllRead(user);
  }

  @Patch("inbox/:id/read")
  @AllowChef()
  inboxRead(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.employeeMarkRead(user, id);
  }

  /** Xodimga kelgan xabar rasmi (`id` — inbox qatori) */
  @Get("inbox/:id/image")
  @AllowChef()
  @Header("Cache-Control", "private, max-age=86400")
  async inboxImage(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const media = await this.service.employeeImage(user, id);
    await sendMediaResponse(res, this.r2, media, "Rasm topilmadi");
  }

  @Get(":id")
  detail(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.detail(user, id);
  }

  /** Yuborilgan xabar rasmi — tarixda */
  @Get(":id/image")
  @Header("Cache-Control", "private, max-age=86400")
  async image(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const media = await this.service.imageForSender(user, id);
    await sendMediaResponse(res, this.r2, media, "Rasm topilmadi");
  }
}

/** Ota-ona kabineti: bog'cha yuborgan xabarlar */
@ApiTags("Parent Cabinet")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent/messages")
export class ParentMessagesController {
  constructor(
    private readonly service: BroadcastsService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  inbox(@CurrentParent() parent: AuthenticatedParent) {
    return this.service.guardianInbox(parent.id);
  }

  @Patch("read-all")
  readAll(@CurrentParent() parent: AuthenticatedParent) {
    return this.service.guardianMarkAllRead(parent.id);
  }

  @Patch(":id/read")
  read(@CurrentParent() parent: AuthenticatedParent, @Param("id") id: string) {
    return this.service.guardianMarkRead(parent.id, id);
  }

  @Get(":id/image")
  @Header("Cache-Control", "private, max-age=86400")
  async image(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const media = await this.service.guardianImage(parent.id, id);
    await sendMediaResponse(res, this.r2, media, "Rasm topilmadi");
  }
}
