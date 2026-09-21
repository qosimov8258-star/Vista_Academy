import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireBranchScope, requireOperationalScope } from "../iam/tenant-auth.types";

const HEAD_CHEF_POSITION = "bosh oshpaz";

function normalizePosition(value: string): string {
  return value.trim().toLowerCase().replace(/[\u2018\u2019`]/g, "'");
}

/**
 * Oshxona bo'limlarida (menyu, ombor) yozish huquqi. Odatda filial admini va
 * administrator yozadi. "Bosh oshpaz" lavozimidagi xodim tizimda TEACHER roli
 * bilan kiradi, lekin bu bo'limlar aynan uning ishi — shuning uchun faqat shu
 * lavozim uchun ruxsat beriladi. Boshqa o'qituvchilarga yopiq.
 */
export async function requireKitchenWriteScope(prisma: PrismaService, scope: TenantScope): Promise<string> {
  if (scope.role !== "TEACHER") {
    return requireOperationalScope(scope);
  }
  const branchId = requireBranchScope(scope);
  const user = await prisma.tenantUser.findUnique({
    where: { id: scope.userId },
    select: { employee: { select: { position: true } } },
  });
  if (!user?.employee || normalizePosition(user.employee.position) !== HEAD_CHEF_POSITION) {
    return requireOperationalScope(scope);
  }
  return branchId;
}
