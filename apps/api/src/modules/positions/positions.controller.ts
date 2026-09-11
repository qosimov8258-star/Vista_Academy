import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { PositionsService } from "./positions.service";
import { CreatePositionDto } from "./dto/create-position.dto";

@ApiBearerAuth()
@ApiTags("Tenant Positions")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/positions")
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.positionsService.findAll(toTenantScope(user));
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreatePositionDto) {
    return this.positionsService.create(toTenantScope(user), dto);
  }
}
