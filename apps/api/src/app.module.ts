import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./database/prisma.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { IamModule } from "./modules/iam/iam.module";
import { WebAuthnModule } from "./modules/webauthn/webauthn.module";
import { PlatformWebAuthnModule } from "./modules/platform-webauthn/platform-webauthn.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { PlansModule } from "./modules/plans/plans.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { GroupsModule } from "./modules/groups/groups.module";
import { ChildrenModule } from "./modules/children/children.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { PositionsModule } from "./modules/positions/positions.module";
import { SubjectsModule } from "./modules/subjects/subjects.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { StaffAttendanceModule } from "./modules/staff-attendance/staff-attendance.module";
import { NutritionModule } from "./modules/nutrition/nutrition.module";
import { DishesModule } from "./modules/dishes/dishes.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { DailyReportsModule } from "./modules/daily-reports/daily-reports.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { LessonScheduleModule } from "./modules/lesson-schedule/lesson-schedule.module";
import { LessonTopicsModule } from "./modules/lesson-topics/lesson-topics.module";
import { LessonGradesModule } from "./modules/lesson-grades/lesson-grades.module";
import { DevelopmentModule } from "./modules/development/development.module";
import { BillingModule } from "./modules/billing/billing.module";
import { TenantDashboardModule } from "./modules/tenant-dashboard/tenant-dashboard.module";
import { TenantUsersModule } from "./modules/tenant-users/tenant-users.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { CrmModule } from "./modules/crm/crm.module";
import { ChildHealthModule } from "./modules/child-health/child-health.module";
import { GuardiansModule } from "./modules/guardians/guardians.module";
import { HrModule } from "./modules/hr/hr.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ExportsModule } from "./modules/exports/exports.module";
import { ParentModule } from "./modules/parent/parent.module";
import { UsefulModule } from "./modules/useful/useful.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    IamModule,
    WebAuthnModule,
    PlatformWebAuthnModule,
    OrganizationsModule,
    PlansModule,
    SubscriptionsModule,
    WalletModule,
    DashboardModule,
    GroupsModule,
    ChildrenModule,
    EmployeesModule,
    PositionsModule,
    SubjectsModule,
    AttendanceModule,
    StaffAttendanceModule,
    NutritionModule,
    DishesModule,
    AuditLogModule,
    DailyReportsModule,
    RoomsModule,
    LessonScheduleModule,
    LessonTopicsModule,
    LessonGradesModule,
    DevelopmentModule,
    BillingModule,
    TenantDashboardModule,
    TenantUsersModule,
    ProfileModule,
    CrmModule,
    ChildHealthModule,
    GuardiansModule,
    HrModule,
    NotificationsModule,
    ExportsModule,
    ParentModule,
    UsefulModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
