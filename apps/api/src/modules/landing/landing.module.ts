import { Module } from "@nestjs/common";
import { LandingAdminController } from "./landing-admin.controller";
import { PublicLandingController } from "./public-landing.controller";
import { LandingService } from "./landing.service";

@Module({
  controllers: [LandingAdminController, PublicLandingController],
  providers: [LandingService],
})
export class LandingModule {}
