import { Module } from "@nestjs/common";
import { PaymentRemindersController } from "./payment-reminders.controller";
import { PaymentRemindersService } from "./payment-reminders.service";
import { PaymentReminderCronService } from "./payment-reminder-cron.service";

@Module({
  controllers: [PaymentRemindersController],
  providers: [PaymentRemindersService, PaymentReminderCronService],
  exports: [PaymentRemindersService],
})
export class PaymentRemindersModule {}
