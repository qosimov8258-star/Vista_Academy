import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { blockedFeatureForRequest, blockedFieldForRequest } from "../../../common/features/feature-catalog";
import { ALLOW_CHEF_KEY } from "../decorators/allow-chef.decorator";
import { DENY_CALL_OPERATOR_KEY } from "../decorators/deny-call-operator.decorator";
import type { TenantAuthenticatedUser } from "../tenant-auth.types";

/** Call operator lavozimi — yangi katalogda "Call Operator", eskisida "Operator". */
const CALL_OPERATOR_POSITIONS = new Set(["call operator", "operator"]);

@Injectable()
export class TenantJwtAuthGuard extends AuthGuard("tenant-jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await super.canActivate(context))) {
      return false;
    }
    // Oshpaz uchun "ruxsat berilganlar ro'yxati": faqat @AllowChef() bilan
    // belgilangan yo'llar ochiq. Boshqa rollarning tekshiruvlari "bu rolga
    // mumkin emas" ko'rinishida yozilgan — yangi rol ularni sezmay o'tib
    // ketmasligi uchun oshpaz shu yerning o'zida to'xtatiladi.
    const request = context.switchToHttp().getRequest<{ user?: TenantAuthenticatedUser; originalUrl?: string; url: string; method: string; body?: unknown }>();
    const user = request.user;
    // Platforma o'chirgan funksiya — tarif yoki bog'cha sozlamasi bo'yicha
    if (user?.disabledFeatures.length) {
      const feature = blockedFeatureForRequest(request.originalUrl ?? request.url, request.method, user.disabledFeatures);
      if (feature) {
        throw new ForbiddenException(`"${feature.label}" funksiyasi sizning panelingiz uchun yoqilmagan — platforma administratoriga murojaat qiling`);
      }
    }
    if (user?.disabledFeatures.length) {
      const blocked = blockedFieldForRequest(request.originalUrl ?? request.url, request.method, request.body, user.disabledFeatures);
      if (blocked) {
        throw new ForbiddenException(`"${blocked.feature.label}" o'chirilgan — "${blocked.field}" maydonini yuborib bo'lmaydi`);
      }
    }
    if (user?.role === "CHEF") {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_CHEF_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException("Oshpaz bu bo'limga kira olmaydi");
      }
    }
    // Call operator (eski katalogda "Operator"): @DenyCallOperator() bilan belgilangan yo'llarga kirmaydi
    if (user?.role === "MANAGER" && CALL_OPERATOR_POSITIONS.has(user.position?.trim().toLowerCase() ?? "")) {
      const denied = this.reflector.getAllAndOverride<boolean>(DENY_CALL_OPERATOR_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (denied) {
        throw new ForbiddenException("Call operator bu bo'limga kira olmaydi");
      }
    }
    return true;
  }
}
