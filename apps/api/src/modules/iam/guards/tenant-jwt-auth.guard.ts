import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { ALLOW_CHEF_KEY } from "../decorators/allow-chef.decorator";
import type { TenantAuthenticatedUser } from "../tenant-auth.types";

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
    const user = context.switchToHttp().getRequest<{ user?: TenantAuthenticatedUser }>().user;
    if (user?.role === "CHEF") {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_CHEF_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException("Oshpaz bu bo'limga kira olmaydi");
      }
    }
    return true;
  }
}
