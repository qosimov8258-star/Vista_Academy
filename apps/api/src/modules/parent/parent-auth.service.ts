import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomInt } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedParent, ParentAccessTokenPayload } from "./parent-auth.types";
import { ChangeParentPasswordDto } from "./dto/change-parent-password.dto";

export interface IssuedParentTokens {
  accessToken: string;
  accessTokenTtlMs: number;
  refreshToken: string;
  refreshTokenTtlMs: number;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const REFRESH_TTL_DAYS = Number(process.env.JWT_PARENT_REFRESH_TTL_DAYS ?? process.env.JWT_REFRESH_TTL_DAYS ?? 60);

/**
 * Parol o'zbekcha sodda so'z + to'rt raqamdan tuziladi: ota-onaga telefonda
 * aytish oson, lekin taxmin qilib bo'lmaydigan darajada tasodifiy.
 * Chalkashadigan harflar (o'/o, i/l) ishlatilmaydi.
 */
const PASSWORD_WORDS = [
  "olma", "anor", "shaftoli", "uzum", "gilos", "bodom", "asal", "quyosh",
  "yulduz", "kapalak", "chumoli", "asalari", "bahor", "chinor", "lola", "nilufar",
];

export function generateParentPassword(): string {
  const word = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const digits = String(randomInt(1000, 10000));
  return `${word}-${digits}`;
}

/**
 * Telefon raqamini yagona ko'rinishga keltiradi: faqat raqamlar, oldida "+".
 * "+998 90 123 45 67", "998901234567" va "90 123 45 67" bir xil hisoblanadi —
 * ota-ona qaysi ko'rinishda yozganini eslab o'tirmasligi kerak.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  return `+${digits}`;
}

@Injectable()
export class ParentAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateCredentials(orgSlug: string, phone: string, password: string): Promise<AuthenticatedParent> {
    const organization = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!organization) {
      throw new UnauthorizedException("Tashkilot topilmadi");
    }

    const guardian = await this.prisma.guardian.findUnique({
      where: { organizationId_phone: { organizationId: organization.id, phone: normalizePhone(phone) } },
    });
    // Bir xil xabar: raqam ro'yxatda bor-yo'qligini tashqaridan bilib
    // bo'lmasligi kerak.
    if (!guardian || !guardian.isActive || !guardian.passwordHash) {
      throw new UnauthorizedException("Telefon raqami yoki parol noto'g'ri");
    }
    const valid = await argon2.verify(guardian.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Telefon raqami yoki parol noto'g'ri");
    }

    await this.prisma.guardian.update({ where: { id: guardian.id }, data: { lastLoginAt: new Date() } });

    return {
      id: guardian.id,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      fullName: guardian.fullName,
      phone: guardian.phone,
    };
  }

  async issueTokens(parent: AuthenticatedParent, meta: RequestMeta): Promise<IssuedParentTokens> {
    const payload: ParentAccessTokenPayload = {
      sub: parent.id,
      organizationId: parent.organizationId,
      organizationSlug: parent.organizationSlug,
      phone: parent.phone,
    };
    const accessTtl = process.env.JWT_PARENT_ACCESS_TTL ?? process.env.JWT_ACCESS_TTL ?? "15m";
    const accessToken = this.jwt.sign(payload, {
      secret: requireParentAccessSecret(),
      expiresIn: accessTtl as JwtSignOptions["expiresIn"],
    });

    const refreshToken = randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.guardianRefreshToken.create({
      data: {
        guardianId: parent.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      accessTokenTtlMs: parseTtlMs(accessTtl),
      refreshToken,
      refreshTokenTtlMs: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    };
  }

  async rotateRefreshToken(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedParentTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.prisma.guardianRefreshToken.findUnique({
      where: { tokenHash },
      include: { guardian: { include: { organization: true } } },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Seans muddati tugagan");
    }
    if (!existing.guardian.isActive || !existing.guardian.passwordHash) {
      throw new UnauthorizedException("Kabinet yopilgan");
    }

    const parent: AuthenticatedParent = {
      id: existing.guardian.id,
      organizationId: existing.guardian.organizationId,
      organizationSlug: existing.guardian.organization.slug,
      organizationName: existing.guardian.organization.name,
      fullName: existing.guardian.fullName,
      phone: existing.guardian.phone,
    };
    const issued = await this.issueTokens(parent, meta);
    await this.prisma.guardianRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: hashToken(issued.refreshToken) },
    });
    return issued;
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.guardianRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Ota-ona o'z parolini almashtiradi; boshqa qurilmalardagi seanslar yopiladi. */
  async changePassword(parent: AuthenticatedParent, dto: ChangeParentPasswordDto) {
    const guardian = await this.prisma.guardian.findUniqueOrThrow({
      where: { id: parent.id },
      select: { passwordHash: true },
    });
    if (!guardian.passwordHash || !(await argon2.verify(guardian.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException("Joriy parol noto'g'ri");
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException("Yangi parol eskisidan farq qilishi kerak");
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.guardian.update({ where: { id: parent.id }, data: { passwordHash } }),
      this.prisma.guardianRefreshToken.updateMany({
        where: { guardianId: parent.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { changed: true };
  }
}

export function requireParentAccessSecret(): string {
  const secret = process.env.JWT_PARENT_ACCESS_SECRET ?? process.env.JWT_TENANT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_PARENT_ACCESS_SECRET (yoki JWT_TENANT_ACCESS_SECRET) sozlanmagan");
  }
  // Xodim tokeni ota-ona kaliti bilan tekshirilib qolmasligi uchun kalit
  // ajratiladi: bir xil sir ishlatilsa ham, prefiks uni farqlaydi.
  return `parent:${secret}`;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return value * factor;
}
