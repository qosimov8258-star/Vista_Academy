import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ParentController } from "./parent.controller";
import { ParentAuthService } from "./parent-auth.service";
import { ParentService } from "./parent.service";
import { ParentJwtStrategy } from "./strategies/parent-jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [ParentController],
  providers: [ParentAuthService, ParentService, ParentJwtStrategy],
  exports: [ParentAuthService],
})
export class ParentModule {}
