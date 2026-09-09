import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { PrismaService } from "../../../database/prisma.service";
import { requireParentAccessSecret } from "../parent-auth.service";
import { AuthenticatedParent, ParentAccessTokenPayload } from "../parent-auth.types";

function extractFromCookie(req: Request): string | null {
  return (req?.cookies?.bogcha_parent_at as string | undefined) ?? null;
}

/**
 * Ota-ona strategiyasi. Nomi ("parent-jwt"), cookie'si va kaliti xodimlar
 * strategiyasidan farq qiladi — bir tokenni ikkinchi joyda ishlatib
 * bo'lmaydi.
 */
@Injectable()
export class ParentJwtStrategy extends PassportStrategy(Strategy, "parent-jwt") {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
      ignoreExpiration: false,
      secretOrKey: requireParentAccessSecret(),
    });
  }

  async validate(payload: ParentAccessTokenPayload): Promise<AuthenticatedParent> {
    const guardian = await this.prisma.guardian.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });
    // Kabinet yopilgan yoki paroli olib tashlangan bo'lsa — token bekor.
    // Tekshiruv har so'rovda bajariladi, shuning uchun yopish darhol kuchga kiradi.
    if (
      !guardian ||
      !guardian.isActive ||
      !guardian.passwordHash ||
      guardian.organizationId !== payload.organizationId
    ) {
      throw new UnauthorizedException("Kabinet topilmadi yoki yopilgan");
    }
    return {
      id: guardian.id,
      organizationId: guardian.organizationId,
      organizationSlug: guardian.organization.slug,
      organizationName: guardian.organization.name,
      fullName: guardian.fullName,
      phone: guardian.phone,
    };
  }
}
