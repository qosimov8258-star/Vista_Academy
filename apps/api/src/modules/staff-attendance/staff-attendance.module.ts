import { Module } from "@nestjs/common";
import { StaffAttendanceController } from "./staff-attendance.controller";
import { StaffAttendanceService } from "./staff-attendance.service";
import { StaffAttendanceReportService } from "./staff-attendance-report.service";

@Module({
  controllers: [StaffAttendanceController],
  providers: [StaffAttendanceService, StaffAttendanceReportService],
  exports: [StaffAttendanceService],
})
export class StaffAttendanceModule {}
