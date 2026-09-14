import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { PrismaService } from "../../../database/prisma.service";
import { requireTenantAccessSecret } from "../tenant-auth.service";
import { TenantAccessTokenPayload, TenantAuthenticatedUser } from "../tenant-auth.types";

function extractFromCookie(req: Request): string | null {
  return (req?.cookies?.bogcha_tenant_at as string | undefined) ?? null;
}

@Injectable()
export class TenantJwtStrategy extends PassportStrategy(Strategy, "tenant-jwt") {
  constructor(private readonly prisma: PrismaService) {
    super({
      // Bearer header birinchi tekshiriladi: har bir tab o'zining sessionStorage'dagi
      // tokenini header orqali yuboradi va bu bitta brauzerdagi umumiy cookie'dan
      // ustun turadi — aks holda ikkinchi tabda kirilgan foydalanuvchi cookie'ni
      // qayta yozib, birinchi tabni ham o'ziga "ko'chiradi".
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: requireTenantAccessSecret(),
    });
  }

  async validate(payload: TenantAccessTokenPayload): Promise<TenantAuthenticatedUser> {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: payload.sub },
      include: { organization: true, branch: true, employee: true },
    });
    if (
      !tenantUser ||
      !tenantUser.isActive ||
      tenantUser.organizationId !== payload.organizationId ||
      tenantUser.branchId !== payload.branchId
    ) {
      throw new UnauthorizedException("User not found or inactive");
    }
    return {
      id: tenantUser.id,
      organizationId: tenantUser.organizationId,
      organizationSlug: tenantUser.organization.slug,
      organizationName: tenantUser.organization.name,
      branchId: tenantUser.branchId,
      branchSlug: tenantUser.branch?.slug ?? null,
      branchName: tenantUser.branch?.name ?? null,
      login: tenantUser.login,
      fullName: tenantUser.fullName,
      role: tenantUser.role,
      avatarUpdatedAt: tenantUser.avatarUpdatedAt?.toISOString() ?? null,
      position: tenantUser.employee?.position ?? null,
      subjects: tenantUser.employee?.subjects ?? [],
      topicsManagedByAdmin: tenantUser.employee?.topicsManagedByAdmin ?? false,
    };
  }
}
