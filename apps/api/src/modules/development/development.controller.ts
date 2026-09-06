import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { DevelopmentService } from "./development.service";
import { UpsertDevelopmentAssessmentDto } from "./dto/upsert-development-assessment.dto";

@ApiBearerAuth()
@ApiTags("Tenant Development Tracking")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class DevelopmentController {
  constructor(private readonly developmentService: DevelopmentService) {}

  @Post("development")
  upsert(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpsertDevelopmentAssessmentDto) {
    return this.developmentService.upsert(toTenantScope(user), dto);
  }

  @Get("children/:id/development")
  findByChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.developmentService.findByChild(toTenantScope(user), id);
  }
}
