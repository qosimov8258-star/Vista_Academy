import { Module } from "@nestjs/common";
import { CashDeskController } from "./cash-desk.controller";
import { CashDeskService } from "./cash-desk.service";
import { PushModule } from "../push/push.module";

@Module({
  imports: [PushModule],
  controllers: [CashDeskController],
  providers: [CashDeskService],
  exports: [CashDeskService],
})
export class CashDeskModule {}
