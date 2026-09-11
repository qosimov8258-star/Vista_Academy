import { Module } from "@nestjs/common";
import { LessonGradesController } from "./lesson-grades.controller";
import { LessonGradesService } from "./lesson-grades.service";

@Module({
  controllers: [LessonGradesController],
  providers: [LessonGradesService],
  exports: [LessonGradesService],
})
export class LessonGradesModule {}
