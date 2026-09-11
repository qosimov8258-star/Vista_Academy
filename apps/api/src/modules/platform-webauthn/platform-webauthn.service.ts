import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type WebAuthnCredential as SimpleWebAuthnCredential,
} from "@simplewebauthn/server";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { WebAuthnChallengeStore } from "../webauthn/webauthn-challenge.store";
import { VerifyRegistrationDto } from "../webauthn/dto/verify-registration.dto";
import { VerifyAuthenticationDto } from "../webauthn/dto/verify-authentication.dto";
import { issuePlatformRevealToken } from "./platform-reveal-token";

function rpID(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

function rpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? "Vista Academy";
}

function allowedOrigins(): string[] {
  const raw = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3100";
  return raw.split(",").map((origin) => origin.trim());
}

/**
 * Tenant tomonidagi `WebAuthnService` bilan bir xil oqim, lekin platforma
 * admini (PlatformUser) qurilmasi uchun — tashkilot Super Admin kabineti
 * parolini "ko'rsatish" shu tasdiqqa bog'liq (`platform-reveal-token.ts`).
 * Ataylab alohida servis: ikkala foydalanuvchi turi bir-biridan mustaqil.
 */
@Injectable()
export class PlatformWebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly challenges: WebAuthnChallengeStore,
  ) {}

  async listCredentials(user: AuthenticatedUser) {
    return this.prisma.platformWebAuthnCredential.findMany({
      where: { platformUserId: user.id },
      select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteCredential(user: AuthenticatedUser, id: string) {
    await this.prisma.platformWebAuthnCredential.deleteMany({ where: { id, platformUserId: user.id } });
    return { success: true };
  }

  async getRegistrationOptions(user: AuthenticatedUser) {
    const existing = await this.prisma.platformWebAuthnCredential.findMany({
      where: { platformUserId: user.id },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpID(),
      userName: user.login,
      userDisplayName: user.fullName,
      attestationType: "none",
      excludeCredentials: existing.map((cred) => ({ id: cred.credentialId, transports: cred.transports })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    this.challenges.save(user.id, "register", options.challenge);
    return options;
  }

  async verifyRegistration(user: AuthenticatedUser, dto: VerifyRegistrationDto) {
    const expectedChallenge = this.challenges.consume(user.id, "register");
    if (!expectedChallenge) {
      throw new BadRequestException("Ro'yxatdan o'tish muddati tugadi, qaytadan urinib ko'ring");
    }

    const verification = await verifyRegistrationResponse({
      response: dto.response,
      expectedChallenge,
      expectedOrigin: allowedOrigins(),
      expectedRPID: rpID(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException("Qurilmani tasdiqlab bo'lmadi");
    }

    const { credential } = verification.registrationInfo;
    await this.prisma.platformWebAuthnCredential.create({
      data: {
        platformUserId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceName: dto.deviceName,
      },
    });

    return { success: true };
  }

  async getAuthenticationOptions(user: AuthenticatedUser) {
    const existing = await this.prisma.platformWebAuthnCredential.findMany({
      where: { platformUserId: user.id },
      select: { credentialId: true, transports: true },
    });
    if (existing.length === 0) {
      throw new BadRequestException("Avval qurilmangizni ro'yxatdan o'tkazing");
    }

    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      allowCredentials: existing.map((cred) => ({ id: cred.credentialId, transports: cred.transports })),
      userVerification: "required",
    });

    this.challenges.save(user.id, "authenticate", options.challenge);
    return options;
  }

  async verifyAuthentication(user: AuthenticatedUser, dto: VerifyAuthenticationDto) {
    const expectedChallenge = this.challenges.consume(user.id, "authenticate");
    if (!expectedChallenge) {
      throw new BadRequestException("Tasdiqlash muddati tugadi, qaytadan urinib ko'ring");
    }

    const stored = await this.prisma.platformWebAuthnCredential.findFirst({
      where: { credentialId: dto.response.id, platformUserId: user.id },
    });
    if (!stored) {
      throw new UnauthorizedException("Bu qurilma ro'yxatdan o'tmagan");
    }

    const credential: SimpleWebAuthnCredential = {
      id: stored.credentialId,
      publicKey: new Uint8Array(stored.publicKey),
      counter: Number(stored.counter),
      transports: stored.transports as SimpleWebAuthnCredential["transports"],
    };

    const verification = await verifyAuthenticationResponse({
      response: dto.response,
      expectedChallenge,
      expectedOrigin: allowedOrigins(),
      expectedRPID: rpID(),
      credential,
    });

    if (!verification.verified) {
      throw new UnauthorizedException("Tasdiqlab bo'lmadi");
    }

    await this.prisma.platformWebAuthnCredential.update({
      where: { id: stored.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });

    return { revealToken: issuePlatformRevealToken(this.jwt, user.id) };
  }
}
