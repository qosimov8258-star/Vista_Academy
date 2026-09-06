import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { GuardiansService } from "./guardians.service";
import { AddChildGuardianDto } from "./dto/add-child-guardian.dto";
import { UpdateChildGuardianDto } from "./dto/update-child-guardian.dto";
import { GuardianQueryDto } from "./dto/guardian-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Guardians")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app")
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get("guardians")
  search(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: GuardianQueryDto) {
    return this.guardiansService.search(toTenantScope(user), query);
  }

  @Get("children/:id/guardians")
  listForChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.guardiansService.listForChild(toTenantScope(user), id);
  }

  @Post("children/:id/guardians")
  addToChild(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: AddChildGuardianDto) {
    return this.guardiansService.addToChild(toTenantScope(user), id, dto);
  }

  @Patch("child-guardians/:linkId")
  updateLink(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("linkId") linkId: string, @Body() dto: UpdateChildGuardianDto) {
    return this.guardiansService.updateLink(toTenantScope(user), linkId, dto);
  }

  @Delete("child-guardians/:linkId")
  removeLink(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("linkId") linkId: string) {
    return this.guardiansService.removeLink(toTenantScope(user), linkId);
  }
}
