import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { DailyReportsController } from "./daily-reports.controller";
import { DailyReportsService } from "./daily-reports.service";

@Module({
  imports: [NotificationsModule],
  controllers: [DailyReportsController],
  providers: [DailyReportsService],
  exports: [DailyReportsService],
})
export class DailyReportsModule {}
