import { Module } from "@nestjs/common";
import { ParentModule } from "../parent/parent.module";
import { ParentEngagementController } from "./parent-engagement.controller";
import { ParentEngagementService } from "./parent-engagement.service";

@Module({
  imports: [ParentModule],
  controllers: [ParentEngagementController],
  providers: [ParentEngagementService],
})
export class ParentEngagementModule {}
