import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";

@ApiBearerAuth()
@ApiTags("Platform Plans")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform/plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll() {
    return this.plansService.findAll();
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.plansService.findOne(id);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }
}
