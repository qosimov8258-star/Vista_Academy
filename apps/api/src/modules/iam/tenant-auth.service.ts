import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { TenantAccessTokenPayload, TenantAuthenticatedUser } from "./tenant-auth.types";

export interface IssuedTenantTokens {
  accessToken: string;
  accessTokenTtlMs: number;
  refreshToken: string;
  refreshTokenTtlMs: number;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const REFRESH_TTL_DAYS = Number(process.env.JWT_TENANT_REFRESH_TTL_DAYS ?? process.env.JWT_REFRESH_TTL_DAYS ?? 30);

@Injectable()
export class TenantAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateCredentials(orgSlug: string, login: string, password: string): Promise<TenantAuthenticatedUser> {
    const organization = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!organization) {
      throw new UnauthorizedException("Tashkilot topilmadi");
    }

    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { organizationId_login: { organizationId: organization.id, login: login.toLowerCase() } },
      include: { branch: true, employee: true },
    });
    if (!tenantUser || !tenantUser.isActive) {
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }
    const passwordValid = await argon2.verify(tenantUser.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }

    return this.toAuthenticatedUser(tenantUser, organization);
  }

  async issueTokens(user: TenantAuthenticatedUser, meta: RequestMeta): Promise<IssuedTenantTokens> {
    const payload: TenantAccessTokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
      branchSlug: user.branchSlug,
      branchId: user.branchId,
      login: user.login,
      role: user.role,
    };
    const accessTtl = process.env.JWT_TENANT_ACCESS_TTL ?? process.env.JWT_ACCESS_TTL ?? "15m";
    const accessToken = this.jwt.sign(payload, {
      secret: requireTenantAccessSecret(),
      expiresIn: accessTtl as JwtSignOptions["expiresIn"],
    });

    const refreshToken = randomBytes(48).toString("hex");
    const refreshTokenHash = hashToken(refreshToken);
    const refreshTokenTtlMs = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + refreshTokenTtlMs);

    await this.prisma.tenantRefreshToken.create({
      data: {
        tenantUserId: user.id,
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

  async rotateRefreshToken(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedTenantTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.tenantRefreshToken.findUnique({
      where: { tokenHash },
      include: { tenantUser: { include: { organization: true, branch: true, employee: true } } },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Sessiya tugagan, qaytadan tizimga kiring");
    }
    if (!existing.tenantUser.isActive) {
      throw new UnauthorizedException("Foydalanuvchi faol emas");
    }

    const user = this.toAuthenticatedUser(existing.tenantUser, existing.tenantUser.organization);
    const issued = await this.issueTokens(user, meta);

    await this.prisma.tenantRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: hashToken(issued.refreshToken) },
    });

    return issued;
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.tenantRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toAuthenticatedUser(
    tenantUser: {
      id: string;
      organizationId: string;
      branchId: string | null;
      branch: { slug: string; name: string } | null;
      login: string;
      fullName: string;
      role: TenantAccessTokenPayload["role"];
      avatarUpdatedAt: Date | null;
      employee: { position: string; subjects: string[] } | null;
    },
    organization: { slug: string; name: string },
  ): TenantAuthenticatedUser {
    return {
      id: tenantUser.id,
      organizationId: tenantUser.organizationId,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      branchId: tenantUser.branchId,
      branchSlug: tenantUser.branch?.slug ?? null,
      branchName: tenantUser.branch?.name ?? null,
      login: tenantUser.login,
      fullName: tenantUser.fullName,
      role: tenantUser.role,
      avatarUpdatedAt: tenantUser.avatarUpdatedAt?.toISOString() ?? null,
      position: tenantUser.employee?.position ?? null,
      subjects: tenantUser.employee?.subjects ?? [],
    };
  }
}

export function requireTenantAccessSecret(): string {
  const secret = process.env.JWT_TENANT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_TENANT_ACCESS_SECRET env var is required");
  }
  return secret;
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
