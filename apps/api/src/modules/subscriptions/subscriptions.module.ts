import { Module } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionBillingService } from "./subscription-billing.service";
import { SubscriptionBillingCronService } from "./subscription-billing-cron.service";
import { PlatformBillingService } from "./platform-billing.service";
import { PlatformBillingController } from "./platform-billing.controller";

@Module({
  controllers: [SubscriptionsController, PlatformBillingController],
  providers: [SubscriptionsService, SubscriptionBillingService, SubscriptionBillingCronService, PlatformBillingService],
  exports: [SubscriptionsService, SubscriptionBillingService],
})
export class SubscriptionsModule {}
