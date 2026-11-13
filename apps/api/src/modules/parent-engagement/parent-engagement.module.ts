import { Module } from "@nestjs/common";
import { ParentEngagementController } from "./parent-engagement.controller";
import { ParentEngagementService } from "./parent-engagement.service";

@Module({
  controllers: [ParentEngagementController],
  providers: [ParentEngagementService],
})
export class ParentEngagementModule {}
