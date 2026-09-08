import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "./tenant-auth.types";

/**
 * O'qituvchiga biriktirilgan guruhlarning id lari.
 *
 * Rol o'qituvchi bo'lmasa `null` qaytadi — bu "guruh bo'yicha cheklov yo'q"
 * degani, ya'ni filial admini va administrator butun filialni ko'raveradi.
 *
 * Bog'lanish zanjiri: TenantUser (login) -> Employee (xodim kartochkasi) ->
 * GroupTeacher. Login xodim kartochkasiga ulanmagan bo'lsa, o'qituvchi hech
 * bir guruhga kira olmaydi — bo'sh ro'yxat qaytadi, hammasi ochiq emas.
 */
export async function resolveTeacherGroupIds(
  prisma: PrismaService,
  scope: TenantScope,
): Promise<string[] | null> {
  if (scope.role !== "TEACHER") {
    return null;
  }
  const employee = await prisma.employee.findUnique({
    where: { tenantUserId: scope.userId },
    select: { teachingGroups: { select: { groupId: true } } },
  });
  return employee?.teachingGroups.map((link) => link.groupId) ?? [];
}

/**
 * O'qituvchi uchun `where` shartiga guruh cheklovini qo'shadi.
 * Boshqa rollarda shart o'zgarishsiz qaytadi.
 */
export function withTeacherGroupFilter<T extends { groupId?: unknown }>(
  where: T,
  groupIds: string[] | null,
): T {
  if (groupIds === null) {
    return where;
  }
  return { ...where, groupId: { in: groupIds } };
}

/**
 * Yozishdan oldin: bola o'qituvchining guruhlaridan birida ekanini tekshiradi.
 * Boshqa rollarda hech nima qilmaydi.
 */
export async function assertTeacherOwnsChild(
  prisma: PrismaService,
  scope: TenantScope,
  child: { groupId: string | null },
): Promise<void> {
  const groupIds = await resolveTeacherGroupIds(prisma, scope);
  if (groupIds === null) {
    return;
  }
  if (!child.groupId || !groupIds.includes(child.groupId)) {
    throw new ForbiddenException("Bu bola sizning guruhingizda emas");
  }
}

/** Bolalar so'rovi uchun tayyor filtr — o'qituvchida guruhlar bilan cheklangan. */
export function teacherChildWhere(
  base: Prisma.ChildWhereInput,
  groupIds: string[] | null,
): Prisma.ChildWhereInput {
  if (groupIds === null) {
    return base;
  }
  return { ...base, groupId: { in: groupIds } };
}
