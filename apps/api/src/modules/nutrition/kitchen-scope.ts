import { ForbiddenException } from "@nestjs/common";
import { TenantScope, requireBranchScope, requireOperationalScope } from "../iam/tenant-auth.types";

/**
 * Oshxona bo'limlarida (menyu, taomlar ro'yxati, taom suratlari) yozish
 * huquqi: oshpaz (CHEF), filial admini va administrator. Ilgari oshpaz
 * TEACHER roli bilan kirib, huquq lavozim nomi ("Bosh oshpaz") bo'yicha
 * berilardi — nom boshqacha yozilsa huquq jimgina yo'qolardi.
 */
export function requireKitchenWriteScope(scope: TenantScope): string {
  if (scope.role === "CHEF") {
    return requireBranchScope(scope);
  }
  return requireOperationalScope(scope);
}

/**
 * Tayyor ovqat suratlarini faqat oshpaz yuklaydi va o'chiradi. Filial admini
 * ularni faqat ko'radi va oshpaz yuklayotganini nazorat qiladi.
 */
export function requireChefPhotoScope(scope: TenantScope): string {
  if (scope.role !== "CHEF") {
    throw new ForbiddenException("Ovqat suratlarini faqat oshpaz yuklaydi");
  }
  return requireBranchScope(scope);
}
