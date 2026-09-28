import { Module } from "@nestjs/common";
import { CashDeskController } from "./cash-desk.controller";
import { CashDeskService } from "./cash-desk.service";

@Module({
  controllers: [CashDeskController],
  providers: [CashDeskService],
  exports: [CashDeskService],
})
export class CashDeskModule {}
