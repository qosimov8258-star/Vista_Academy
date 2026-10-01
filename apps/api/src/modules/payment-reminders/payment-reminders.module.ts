import { Module } from "@nestjs/common";
import { PaymentRemindersController } from "./payment-reminders.controller";
import { PaymentRemindersService } from "./payment-reminders.service";
import { PaymentReminderCronService } from "./payment-reminder-cron.service";
import { PushModule } from "../push/push.module";

@Module({
  imports: [PushModule],
  controllers: [PaymentRemindersController],
  providers: [PaymentRemindersService, PaymentReminderCronService],
  exports: [PaymentRemindersService],
})
export class PaymentRemindersModule {}
