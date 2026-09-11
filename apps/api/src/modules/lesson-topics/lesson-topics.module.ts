import { Module } from "@nestjs/common";
import { LessonTopicsController } from "./lesson-topics.controller";
import { LessonTopicsService } from "./lesson-topics.service";

@Module({
  controllers: [LessonTopicsController],
  providers: [LessonTopicsService],
  exports: [LessonTopicsService],
})
export class LessonTopicsModule {}
