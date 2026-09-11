import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { AuditLogService } from "./audit-log.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Audit Log")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(user, query);
  }
}
