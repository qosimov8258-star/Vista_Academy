import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { TenantAuthenticatedUser } from "../iam/tenant-auth.types";

/**
 * Lending sayt (vista-academy.uz) bitta tashkilotniki: `Landing*` jadvallarida
 * tashkilot ustuni yo'q. Bog'cha panelidan uni faqat o'sha tashkilot
 * tahrirlaydi — aks holda istalgan bog'cha admini boshqaning saytidagi
 * o'qituvchi/guruh/matnlarni o'zgartirib yoki o'chirib yuborardi.
 */
export function landingOwnerSlug(): string {
  return (process.env.LANDING_ORGANIZATION_SLUG ?? "vista-academy").trim().toLowerCase();
}

/**
 * TenantJwtAuthGuard dan keyin qo'yiladi. Guard interceptor'dan oldin ishlaydi,
 * shuning uchun ruxsatsiz so'rovning fayli diskka umuman yozilmaydi.
 */
@Injectable()
export class LandingOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: TenantAuthenticatedUser }>().user;
    if (!user || user.organizationSlug.toLowerCase() !== landingOwnerSlug()) {
      throw new ForbiddenException("Lending sahifani faqat uning egasi bo'lgan tashkilot tahrirlaydi");
    }
    return true;
  }
}
