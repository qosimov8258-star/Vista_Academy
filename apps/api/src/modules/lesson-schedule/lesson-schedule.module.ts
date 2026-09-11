import { Module } from "@nestjs/common";
import { LessonScheduleController } from "./lesson-schedule.controller";
import { LessonScheduleService } from "./lesson-schedule.service";

@Module({
  controllers: [LessonScheduleController],
  providers: [LessonScheduleService],
  exports: [LessonScheduleService],
})
export class LessonScheduleModule {}
