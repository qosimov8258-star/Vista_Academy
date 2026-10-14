import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformUserRole } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationFeaturesService } from "./organization-features.service";
import { UpdateOrganizationFeaturesDto } from "./dto/update-organization-features.dto";

@ApiBearerAuth()
@ApiTags("Platform Features")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("platform")
export class FeaturesController {
  constructor(private readonly features: OrganizationFeaturesService) {}

  /** Boshqariladigan funksiyalar ro'yxati (tarif va bog'cha sahifalari shundan chizadi). */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get("features")
  catalog() {
    return this.features.catalog();
  }

  /** Alohida cheklash mumkin bo'lgan panellar (Super Admin, O'qituvchilar, Ota-onalar ...). */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get("feature-panels")
  panels() {
    return this.features.panels();
  }

  /** `?panel=TEACHER` — shu panel uchun; bo'sh bo'lsa butun bog'cha. */
  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN, PlatformUserRole.PLATFORM_SUPPORT)
  @Get("organizations/:id/features")
  get(@Param("id") id: string, @Query("panel") panel?: string) {
    return this.features.get(id, panel || undefined);
  }

  @Roles(PlatformUserRole.PLATFORM_SUPER_ADMIN)
  @Patch("organizations/:id/features")
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationFeaturesDto, @Query("panel") panel?: string) {
    return this.features.setOverrides(id, dto.overrides, panel || undefined);
  }
}
