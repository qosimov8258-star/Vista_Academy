import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { OrganizationsController } from "./organizations.controller";
import { TenantOrganizationsController } from "./tenant-organizations.controller";
import { PublicOrganizationsController } from "./public-organizations.controller";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrganizationsController, TenantOrganizationsController, PublicOrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
