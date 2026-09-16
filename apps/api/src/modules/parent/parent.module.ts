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
import { DiaryModule } from "../diary/diary.module";

@Module({
  imports: [PassportModule, JwtModule.register({}), DiaryModule],
  controllers: [ParentController, ParentUsefulController, ParentDiaryController],
  providers: [ParentAuthService, ParentService, ParentJwtStrategy, ParentUsefulService, ParentDiaryService],
  exports: [ParentAuthService],
})
export class ParentModule {}
