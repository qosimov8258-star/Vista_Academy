import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ParentController } from "./parent.controller";
import { ParentAuthService } from "./parent-auth.service";
import { ParentService } from "./parent.service";
import { ParentJwtStrategy } from "./strategies/parent-jwt.strategy";
import { ParentUsefulController } from "./parent-useful.controller";
import { ParentUsefulService } from "./parent-useful.service";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [ParentController, ParentUsefulController],
  providers: [ParentAuthService, ParentService, ParentJwtStrategy, ParentUsefulService],
  exports: [ParentAuthService],
})
export class ParentModule {}
