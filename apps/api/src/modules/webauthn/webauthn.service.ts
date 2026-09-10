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
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { WebAuthnChallengeStore } from "./webauthn-challenge.store";
import { VerifyRegistrationDto } from "./dto/verify-registration.dto";
import { VerifyAuthenticationDto } from "./dto/verify-authentication.dto";
import { issueRevealToken } from "./reveal-token";

function rpID(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

function rpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? "Vista Academy";
}

function allowedOrigins(): string[] {
  const raw = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3101";
  return raw.split(",").map((origin) => origin.trim());
}

/**
 * Admin qurilmasini "passkey" sifatida ro'yxatdan o'tkazish va keyinchalik
 * shu qurilma bilan tasdiqlash — xodim parolini ko'rsatish shu tasdiqqa
 * bog'liq (`reveal-token.ts`). Har bir tenantUser o'zining qurilmalarini
 * ko'radi, boshqa foydalanuvchining credentiallariga tegmaydi.
 */
@Injectable()
export class WebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly challenges: WebAuthnChallengeStore,
  ) {}

  async listCredentials(user: TenantAuthenticatedUser) {
    return this.prisma.webAuthnCredential.findMany({
      where: { tenantUserId: user.id },
      select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteCredential(user: TenantAuthenticatedUser, id: string) {
    await this.prisma.webAuthnCredential.deleteMany({ where: { id, tenantUserId: user.id } });
    return { success: true };
  }

  async getRegistrationOptions(user: TenantAuthenticatedUser) {
    const existing = await this.prisma.webAuthnCredential.findMany({
      where: { tenantUserId: user.id },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: rpName(),
      rpID: rpID(),
      userName: user.email,
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

  async verifyRegistration(user: TenantAuthenticatedUser, dto: VerifyRegistrationDto) {
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
    await this.prisma.webAuthnCredential.create({
      data: {
        tenantUserId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceName: dto.deviceName,
      },
    });

    return { success: true };
  }

  async getAuthenticationOptions(user: TenantAuthenticatedUser) {
    const existing = await this.prisma.webAuthnCredential.findMany({
      where: { tenantUserId: user.id },
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

  async verifyAuthentication(user: TenantAuthenticatedUser, dto: VerifyAuthenticationDto) {
    const expectedChallenge = this.challenges.consume(user.id, "authenticate");
    if (!expectedChallenge) {
      throw new BadRequestException("Tasdiqlash muddati tugadi, qaytadan urinib ko'ring");
    }

    const stored = await this.prisma.webAuthnCredential.findFirst({
      where: { credentialId: dto.response.id, tenantUserId: user.id },
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

    await this.prisma.webAuthnCredential.update({
      where: { id: stored.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });

    return { revealToken: issueRevealToken(this.jwt, user.id) };
  }
}
