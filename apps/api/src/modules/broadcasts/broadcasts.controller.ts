import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
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
  constructor(private readonly service: BroadcastsService) {}

  @Get()
  list(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: BroadcastListQueryDto, @Query("branchId") branchId?: string) {
    return this.service.list(user, query, branchId);
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

  @Get(":id")
  detail(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.service.detail(user, id);
  }
}

/** Ota-ona kabineti: bog'cha yuborgan xabarlar */
@ApiTags("Parent Cabinet")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent/messages")
export class ParentMessagesController {
  constructor(private readonly service: BroadcastsService) {}

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
}
