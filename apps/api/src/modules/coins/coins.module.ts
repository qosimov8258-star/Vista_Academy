import { Module } from "@nestjs/common";
import { CoinsController } from "./coins.controller";
import { CoinsService } from "./coins.service";
import { WeeklyCoinAssessmentsController } from "./weekly-coin-assessments.controller";
import { WeeklyCoinAssessmentsService } from "./weekly-coin-assessments.service";

@Module({
  controllers: [CoinsController, WeeklyCoinAssessmentsController],
  providers: [CoinsService, WeeklyCoinAssessmentsService],
  exports: [CoinsService, WeeklyCoinAssessmentsService],
})
export class CoinsModule {}
