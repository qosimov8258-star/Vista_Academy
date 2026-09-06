import { Module } from "@nestjs/common";
import { ChildrenModule } from "../children/children.module";
import { GroupsModule } from "../groups/groups.module";
import { EmployeesModule } from "../employees/employees.module";
import { AttendanceModule } from "../attendance/attendance.module";
import { StaffAttendanceModule } from "../staff-attendance/staff-attendance.module";
import { DailyReportsModule } from "../daily-reports/daily-reports.module";
import { BillingModule } from "../billing/billing.module";
import { CrmModule } from "../crm/crm.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TenantDashboardController } from "./tenant-dashboard.controller";
import { TenantDashboardService } from "./tenant-dashboard.service";

@Module({
  imports: [
    ChildrenModule,
    GroupsModule,
    EmployeesModule,
    AttendanceModule,
    StaffAttendanceModule,
    DailyReportsModule,
    BillingModule,
    CrmModule,
    NotificationsModule,
  ],
  controllers: [TenantDashboardController],
  providers: [TenantDashboardService],
})
export class TenantDashboardModule {}
