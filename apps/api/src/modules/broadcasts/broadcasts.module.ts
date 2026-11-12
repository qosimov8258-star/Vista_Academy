import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { BroadcastsController, ParentMessagesController } from "./broadcasts.controller";
import { BroadcastsService } from "./broadcasts.service";

@Module({
  imports: [PushModule],
  controllers: [BroadcastsController, ParentMessagesController],
  providers: [BroadcastsService],
})
export class BroadcastsModule {}
