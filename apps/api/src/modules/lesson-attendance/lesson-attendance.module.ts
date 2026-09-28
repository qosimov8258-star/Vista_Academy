import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { LessonAttendanceController } from "./lesson-attendance.controller";
import { LessonAttendanceService } from "./lesson-attendance.service";

@Module({
  imports: [NotificationsModule],
  controllers: [LessonAttendanceController],
  providers: [LessonAttendanceService],
})
export class LessonAttendanceModule {}
