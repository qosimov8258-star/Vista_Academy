import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { PaymentReceiptsController } from "./payment-receipts.controller";
import { PaymentReceiptsService } from "./payment-receipts.service";

@Module({
  imports: [BillingModule],
  controllers: [PaymentReceiptsController],
  providers: [PaymentReceiptsService],
  exports: [PaymentReceiptsService],
})
export class PaymentReceiptsModule {}
