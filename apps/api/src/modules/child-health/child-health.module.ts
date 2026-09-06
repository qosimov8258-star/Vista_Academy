import { Module } from "@nestjs/common";
import { ChildHealthController } from "./child-health.controller";
import { ChildHealthService } from "./child-health.service";

@Module({
  controllers: [ChildHealthController],
  providers: [ChildHealthService],
})
export class ChildHealthModule {}
