import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { TenantOrganizationsController } from "./tenant-organizations.controller";
import { PublicOrganizationsController } from "./public-organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  controllers: [OrganizationsController, TenantOrganizationsController, PublicOrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
