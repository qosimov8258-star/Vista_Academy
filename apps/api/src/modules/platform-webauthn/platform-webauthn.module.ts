import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PlatformWebAuthnController } from "./platform-webauthn.controller";
import { PlatformWebAuthnService } from "./platform-webauthn.service";
import { WebAuthnChallengeStore } from "../webauthn/webauthn-challenge.store";

@Module({
  imports: [JwtModule.register({})],
  controllers: [PlatformWebAuthnController],
  providers: [PlatformWebAuthnService, WebAuthnChallengeStore],
})
export class PlatformWebAuthnModule {}
