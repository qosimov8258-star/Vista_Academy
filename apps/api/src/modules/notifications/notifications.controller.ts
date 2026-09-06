import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { MarkNotificationSentDto } from "./dto/mark-notification-sent.dto";
import { NotificationQueryDto } from "./dto/notification-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Notifications")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(user, dto);
  }

  @Patch(":id/mark-sent")
  markSent(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: MarkNotificationSentDto) {
    return this.notificationsService.markSent(user, id, dto);
  }
}
