import { Module } from "@nestjs/common";
import { CashDeskModule } from "../cash-desk/cash-desk.module";
import { AdminDeskController } from "./admin-desk.controller";
import { AdminDeskService } from "./admin-desk.service";

@Module({
  imports: [CashDeskModule],
  controllers: [AdminDeskController],
  providers: [AdminDeskService],
})
export class AdminDeskModule {}
