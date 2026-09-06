import { Injectable } from "@nestjs/common";
import { TenantScope } from "../iam/tenant-auth.types";
import { ChildrenService } from "../children/children.service";
import { GroupsService } from "../groups/groups.service";
import { EmployeesService } from "../employees/employees.service";
import { AttendanceService } from "../attendance/attendance.service";
import { StaffAttendanceService } from "../staff-attendance/staff-attendance.service";
import { DailyReportsService } from "../daily-reports/daily-reports.service";
import { BillingService } from "../billing/billing.service";
import { CrmService } from "../crm/crm.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly childrenService: ChildrenService,
    private readonly groupsService: GroupsService,
    private readonly employeesService: EmployeesService,
    private readonly attendanceService: AttendanceService,
    private readonly staffAttendanceService: StaffAttendanceService,
    private readonly dailyReportsService: DailyReportsService,
    private readonly billingService: BillingService,
    private readonly crmService: CrmService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async summary(scope: TenantScope) {
    const [
      childrenCount,
      activeGroupsCount,
      employeesCount,
      monthRevenue,
      outstandingDebt,
      todayAttendance,
      todayStaffAttendance,
      todayDailyReportsFilled,
      activeLeadsCount,
      pendingNotificationsCount,
    ] = await Promise.all([
      this.childrenService.countActive(scope),
      this.groupsService.countActive(scope),
      this.employeesService.countActive(scope),
      this.billingService.monthRevenue(scope),
      this.billingService.outstandingDebt(scope),
      this.attendanceService.todaySummary(scope),
      this.staffAttendanceService.todaySummary(scope),
      this.dailyReportsService.todayFilledCount(scope),
      this.crmService.countActive(scope),
      this.notificationsService.countPending(scope),
    ]);

    return {
      childrenCount,
      activeGroupsCount,
      employeesCount,
      monthRevenue,
      outstandingDebt,
      todayAttendance,
      todayStaffAttendance,
      todayDailyReportsFilled,
      activeLeadsCount,
      pendingNotificationsCount,
    };
  }
}
