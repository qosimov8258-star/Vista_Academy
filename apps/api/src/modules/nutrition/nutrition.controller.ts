import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { NutritionService } from "./nutrition.service";
import { UpsertMenuEntryDto } from "./dto/upsert-menu-entry.dto";
import { MenuQueryDto } from "./dto/menu-query.dto";

@ApiBearerAuth()
@ApiTags("Tenant Nutrition")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/menu")
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Get()
  findRange(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: MenuQueryDto) {
    return this.nutritionService.findRange(toTenantScope(user), query);
  }

  @Post()
  upsert(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: UpsertMenuEntryDto) {
    return this.nutritionService.upsert(toTenantScope(user), dto);
  }
}
