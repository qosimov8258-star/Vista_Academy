import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PushModule } from "../push/push.module";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { AttendanceReportService } from "./attendance-report.service";

@Module({
  imports: [NotificationsModule, PushModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceReportService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
