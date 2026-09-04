import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { CreateBranchDto } from "./dto/create-branch.dto";

@ApiBearerAuth()
@ApiTags("Platform Organizations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform/organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get()
  findAll(@Query() query: OrganizationQueryDto) {
    return this.organizationsService.findAll(query);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.organizationsService.findOne(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post(":id/branches")
  addBranch(@Param("id") id: string, @Body() dto: CreateBranchDto) {
    return this.organizationsService.addBranch(id, dto);
  }
}
