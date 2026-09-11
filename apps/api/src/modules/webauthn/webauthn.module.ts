import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { WebAuthnController } from "./webauthn.controller";
import { WebAuthnService } from "./webauthn.service";
import { WebAuthnChallengeStore } from "./webauthn-challenge.store";

@Module({
  imports: [JwtModule.register({})],
  controllers: [WebAuthnController],
  providers: [WebAuthnService, WebAuthnChallengeStore],
})
export class WebAuthnModule {}
