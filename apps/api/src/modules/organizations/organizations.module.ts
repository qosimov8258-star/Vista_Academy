import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { OrganizationsController } from "./organizations.controller";
import { TenantOrganizationsController } from "./tenant-organizations.controller";
import { PublicOrganizationsController } from "./public-organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { FeaturesController } from "./features.controller";
import { OrganizationFeaturesService } from "./organization-features.service";
import { OrganizationLifecycleService } from "./organization-lifecycle.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrganizationsController, TenantOrganizationsController, PublicOrganizationsController, FeaturesController],
  providers: [OrganizationsService, OrganizationLifecycleService, OrganizationFeaturesService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
