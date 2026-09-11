import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { DishesService } from "./dishes.service";
import { CreateDishDto } from "./dto/create-dish.dto";
import { UpdateDishDto } from "./dto/update-dish.dto";

@ApiBearerAuth()
@ApiTags("Tenant Dishes")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/dishes")
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.dishesService.findAll(toTenantScope(user));
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateDishDto) {
    return this.dishesService.create(toTenantScope(user), dto);
  }

  @Patch(":id")
  update(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateDishDto) {
    return this.dishesService.update(toTenantScope(user), id, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.dishesService.remove(toTenantScope(user), id);
  }
}
