import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { WebAuthnService } from "./webauthn.service";
import { VerifyRegistrationDto } from "./dto/verify-registration.dto";
import { VerifyAuthenticationDto } from "./dto/verify-authentication.dto";

/**
 * Admin qurilmasini passkey sifatida ro'yxatga olish va tasdiqlash — xodim
 * parolini "ko'rsatish" shu tasdiqqa bog'liq. Har bir tenantUser faqat
 * o'zining qurilmalarini ko'radi/boshqaradi.
 */
@ApiBearerAuth()
@ApiTags("Tenant WebAuthn")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/webauthn")
export class WebAuthnController {
  constructor(private readonly webauthn: WebAuthnService) {}

  @Get("credentials")
  listCredentials(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.webauthn.listCredentials(user);
  }

  @Delete("credentials/:id")
  deleteCredential(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.webauthn.deleteCredential(user, id);
  }

  @Post("registration/options")
  getRegistrationOptions(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.webauthn.getRegistrationOptions(user);
  }

  @Post("registration/verify")
  verifyRegistration(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: VerifyRegistrationDto) {
    return this.webauthn.verifyRegistration(user, dto);
  }

  @Post("authentication/options")
  getAuthenticationOptions(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return this.webauthn.getAuthenticationOptions(user);
  }

  @Post("authentication/verify")
  verifyAuthentication(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: VerifyAuthenticationDto) {
    return this.webauthn.verifyAuthentication(user, dto);
  }
}
