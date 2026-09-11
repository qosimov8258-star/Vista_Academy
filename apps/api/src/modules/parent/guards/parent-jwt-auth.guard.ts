import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

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
}
