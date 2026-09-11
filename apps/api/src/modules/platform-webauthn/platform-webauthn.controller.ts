import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { PlatformWebAuthnService } from "./platform-webauthn.service";
import { VerifyRegistrationDto } from "../webauthn/dto/verify-registration.dto";
import { VerifyAuthenticationDto } from "../webauthn/dto/verify-authentication.dto";

/**
 * Platforma admini qurilmasini passkey sifatida ro'yxatga olish va
 * tasdiqlash — tashkilot Super Admin kabineti parolini "ko'rsatish" shu
 * tasdiqqa bog'liq. Tenant tomonidagi `app/webauthn`dan mustaqil.
 */
@ApiBearerAuth()
@ApiTags("Platform WebAuthn")
@UseGuards(JwtAuthGuard)
@Controller("platform/webauthn")
export class PlatformWebAuthnController {
  constructor(private readonly webauthn: PlatformWebAuthnService) {}

  @Get("credentials")
  listCredentials(@CurrentUser() user: AuthenticatedUser) {
    return this.webauthn.listCredentials(user);
  }

  @Delete("credentials/:id")
  deleteCredential(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.webauthn.deleteCredential(user, id);
  }

  @Post("registration/options")
  getRegistrationOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.webauthn.getRegistrationOptions(user);
  }

  @Post("registration/verify")
  verifyRegistration(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyRegistrationDto) {
    return this.webauthn.verifyRegistration(user, dto);
  }

  @Post("authentication/options")
  getAuthenticationOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.webauthn.getAuthenticationOptions(user);
  }

  @Post("authentication/verify")
  verifyAuthentication(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyAuthenticationDto) {
    return this.webauthn.verifyAuthentication(user, dto);
  }
}
