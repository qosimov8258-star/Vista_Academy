import { Module } from "@nestjs/common";
import { EmployeeNotificationsController } from "./employee-notifications.controller";
import { EmployeeNotificationsService } from "./employee-notifications.service";

@Module({
  controllers: [EmployeeNotificationsController],
  providers: [EmployeeNotificationsService],
})
export class EmployeeNotificationsModule {}
