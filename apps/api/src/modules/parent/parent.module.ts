import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ParentController } from "./parent.controller";
import { ParentAuthService } from "./parent-auth.service";
import { ParentService } from "./parent.service";
import { ParentJwtStrategy } from "./strategies/parent-jwt.strategy";
import { ParentUsefulController } from "./parent-useful.controller";
import { ParentUsefulService } from "./parent-useful.service";
import { ParentDiaryController } from "./parent-diary.controller";
import { ParentDiaryService } from "./parent-diary.service";
import { ParentPushController } from "./parent-push.controller";
import { ParentActivityController } from "./parent-activity.controller";
import { ParentActivityService } from "./parent-activity.service";
import { DiaryModule } from "../diary/diary.module";
import { PaymentRemindersModule } from "../payment-reminders/payment-reminders.module";
import { PaymentReceiptsModule } from "../payment-receipts/payment-receipts.module";
import { PushModule } from "../push/push.module";

@Module({
  imports: [PassportModule, JwtModule.register({}), DiaryModule, PaymentRemindersModule, PaymentReceiptsModule, PushModule],
  controllers: [ParentController, ParentUsefulController, ParentDiaryController, ParentPushController, ParentActivityController],
  providers: [ParentAuthService, ParentService, ParentJwtStrategy, ParentUsefulService, ParentDiaryService, ParentActivityService],
  exports: [ParentAuthService],
})
export class ParentModule {}
