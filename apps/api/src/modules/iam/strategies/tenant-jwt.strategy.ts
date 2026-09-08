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
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: requireTenantAccessSecret(),
    });
  }

  async validate(payload: TenantAccessTokenPayload): Promise<TenantAuthenticatedUser> {
    const tenantUser = await this.prisma.tenantUser.findUnique({
      where: { id: payload.sub },
      include: { organization: true, branch: true },
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
      email: tenantUser.email,
      fullName: tenantUser.fullName,
      role: tenantUser.role,
      avatarUpdatedAt: tenantUser.avatarUpdatedAt?.toISOString() ?? null,
    };
  }
}
