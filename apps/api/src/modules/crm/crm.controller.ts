import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CrmService } from "./crm.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadStageDto } from "./dto/update-lead-stage.dto";
import { CreateLeadActivityDto } from "./dto/create-lead-activity.dto";
import { ConvertLeadDto } from "./dto/convert-lead.dto";

@ApiBearerAuth()
@ApiTags("Tenant CRM")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/leads")
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: LeadQueryDto) {
    return this.crmService.findAll(toTenantScope(user), query);
  }

  @Get("stats")
  stats(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.crmService.stats(toTenantScope(user));
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.crmService.create(user, dto);
  }

  @Get(":id")
  findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.crmService.findOne(toTenantScope(user), id);
  }

  @Patch(":id/stage")
  updateStage(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateLeadStageDto) {
    return this.crmService.updateStage(user, id, dto);
  }

  @Post(":id/activities")
  addActivity(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: CreateLeadActivityDto) {
    return this.crmService.addActivity(user, id, dto);
  }

  @Post(":id/convert")
  convert(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: ConvertLeadDto) {
    return this.crmService.convert(user, id, dto);
  }
}
