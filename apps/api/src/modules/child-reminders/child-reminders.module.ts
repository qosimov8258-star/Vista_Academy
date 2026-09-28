import { Module } from "@nestjs/common";
import { ChildRemindersController } from "./child-reminders.controller";
import { ChildRemindersService } from "./child-reminders.service";

@Module({
  controllers: [ChildRemindersController],
  providers: [ChildRemindersService],
})
export class ChildRemindersModule {}
