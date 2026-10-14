import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { blockedFeatureForRequest } from "../../../common/features/feature-catalog";
import type { AuthenticatedParent } from "../parent-auth.types";

/**
 * Faqat ota-ona tokenini qabul qiladi.
 *
 * Bo'sh konstruktor ataylab yozilgan: ustki sinf konstruktorida
 * `AuthModuleOptions` bor va uni meros qilib olsak, Nest shu bog'liqlikni
 * modulda qidiradi (PassportModule uni faqat `.register()` bilan beradi).
 * TenantJwtAuthGuard ham xuddi shunday qilingan.
 */
@Injectable()
export class ParentJwtAuthGuard extends AuthGuard("parent-jwt") {
  constructor() {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) {
      return false;
    }
    // Platforma o'chirgan funksiya (masalan "Ota-ona kabineti", "Kundalik")
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedParent; originalUrl?: string; url: string; method: string }>();
    if (request.user?.disabledFeatures.length) {
      const feature = blockedFeatureForRequest(request.originalUrl ?? request.url, request.method, request.user.disabledFeatures);
      if (feature) {
        throw new ForbiddenException(`"${feature.label}" funksiyasi bu bog'cha uchun yoqilmagan`);
      }
    }
    return true;
  }
}
