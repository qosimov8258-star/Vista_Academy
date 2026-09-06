import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { TenantUsersService } from "./tenant-users.service";
import { CreateTenantUserDto } from "./dto/create-tenant-user.dto";

@ApiBearerAuth()
@ApiTags("Tenant Users")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/users")
export class TenantUsersController {
  constructor(private readonly tenantUsersService: TenantUsersService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.tenantUsersService.findAll(user);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateTenantUserDto) {
    return this.tenantUsersService.create(user, dto);
  }
}
