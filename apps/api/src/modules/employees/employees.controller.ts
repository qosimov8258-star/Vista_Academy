import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, EmployeeAccountDto } from "./dto/create-employee.dto";
import { UpdateEmployeeGroupsDto } from "./dto/update-employee-groups.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Employees")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(toTenantScope(user), dto);
  }

  @Post(":id/account")
  openAccount(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: EmployeeAccountDto,
  ) {
    return this.employeesService.openAccount(toTenantScope(user), id, dto);
  }

  @Patch(":id/groups")
  updateGroups(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeGroupsDto,
  ) {
    return this.employeesService.updateGroups(toTenantScope(user), id, dto);
  }
}
