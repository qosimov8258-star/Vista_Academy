import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { AccessTokenPayload, AuthenticatedUser } from "./auth.types";

export interface IssuedTokens {
  accessToken: string;
  accessTokenTtlMs: number;
  refreshToken: string;
  refreshTokenTtlMs: number;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.platformUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }
    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }
    return { id: user.id, email: user.email, role: user.role, fullName: user.fullName };
  }

  async issueTokens(user: AuthenticatedUser, meta: RequestMeta): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const accessTtl = process.env.JWT_ACCESS_TTL ?? "15m";
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: accessTtl as JwtSignOptions["expiresIn"],
    });

    const refreshToken = randomBytes(48).toString("hex");
    const refreshTokenHash = hashToken(refreshToken);
    const refreshTokenTtlMs = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + refreshTokenTtlMs);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return {
      accessToken,
      accessTokenTtlMs: parseDurationToMs(accessTtl),
      refreshToken,
      refreshTokenTtlMs,
    };
  }

  async rotateRefreshToken(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Sessiya tugagan, qaytadan tizimga kiring");
    }
    if (!existing.user.isActive) {
      throw new UnauthorizedException("Foydalanuvchi faol emas");
    }

    const user: AuthenticatedUser = {
      id: existing.user.id,
      email: existing.user.email,
      role: existing.user.role,
      fullName: existing.user.fullName,
    };

    const issued = await this.issueTokens(user, meta);

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: hashToken(issued.refreshToken) },
    });

    return issued;
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 60_000;
  return value * unitMs;
}
