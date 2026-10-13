import { Module } from "@nestjs/common";
import { CashDeskController } from "./cash-desk.controller";
import { CashDeskService } from "./cash-desk.service";
import { PaymentsReportService } from "./payments-report.service";
import { ExpensesReportService } from "./expenses-report.service";
import { PushModule } from "../push/push.module";

@Module({
  imports: [PushModule],
  controllers: [CashDeskController],
  providers: [CashDeskService, PaymentsReportService, ExpensesReportService],
  exports: [CashDeskService],
})
export class CashDeskModule {}
