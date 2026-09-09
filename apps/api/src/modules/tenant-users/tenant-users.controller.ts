import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { TenantUsersService } from "./tenant-users.service";
import { CreateTenantUserDto } from "./dto/create-tenant-user.dto";
import { SetTenantUserStatusDto, UpdateTenantUserDto } from "./dto/update-tenant-user.dto";

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

  /** Ism, rol yoki parolni tahrirlash. */
  @Patch(":id")
  update(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateTenantUserDto,
  ) {
    return this.tenantUsersService.update(user, id, dto);
  }

  /** Hisobni bloklash yoki blokdan chiqarish. */
  @Patch(":id/status")
  setStatus(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SetTenantUserStatusDto,
  ) {
    return this.tenantUsersService.setStatus(user, id, dto);
  }

  /** Loginni o'chirish (xodim kartochkasi saqlanib qoladi). */
  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.tenantUsersService.remove(user, id);
  }
}
