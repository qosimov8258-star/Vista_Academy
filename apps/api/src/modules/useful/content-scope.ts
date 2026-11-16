import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { assertTeacherOwnsGroup } from "../iam/teacher-scope";
import { AuthenticatedParent } from "../parent/parent-auth.types";

/**
 * Ota-onalarga mo'ljallangan mazmun (maqolalar, galereya) uchun umumiy
 * ruxsat qoidalari — «Foydali» bo'limi (UsefulService) bilan bir xil:
 *   • TEACHER — o'z guruhlari; BRANCH_ADMIN/MANAGER — butun filial;
 *   • NETWORK_ADMIN — faqat o'qiydi, `?branchId=` bilan;
 *   • FINANCE — ko'rmaydi; CHEF — kontrollerda `@AllowChef` yo'q, kira olmaydi.
 */

export function requireContentView(scope: TenantScope) {
  if (scope.role === "FINANCE") {
    throw new ForbiddenException("Moliyachi bu bo'limni ko'ra olmaydi");
  }
}

/** O'qish uchun filial: filial rollari — o'z filiali, NETWORK_ADMIN — tanlagani yoki butun tashkilot (null) */
export async function resolveContentReadBranch(
  prisma: PrismaService,
  scope: TenantScope,
  queryBranchId?: string,
): Promise<string | null> {
  requireContentView(scope);
  if (scope.branchId) {
    if (queryBranchId && queryBranchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    return scope.branchId;
  }
  if (!queryBranchId) {
    return null;
  }
  const branch = await prisma.branch.findFirst({ where: { id: queryBranchId, organizationId: scope.organizationId } });
  if (!branch) {
    throw new NotFoundException("Filial topilmadi");
  }
  return branch.id;
}

/**
 * Yozish uchun guruhni tekshiradi. `required` — guruh majburiy (galereya);
 * aks holda o'qituvchi uchun majburiy, boshqalar uchun null = butun filial.
 */
export async function resolveContentGroupForWrite(
  prisma: PrismaService,
  scope: TenantScope,
  branchId: string,
  groupId: string | null | undefined,
  required = false,
): Promise<string | null> {
  if ((required || scope.role === "TEACHER") && !groupId) {
    throw new BadRequestException("Guruhni tanlang");
  }
  if (!groupId) {
    return null;
  }
  const group = await prisma.group.findFirst({ where: { id: groupId, branch: { organizationId: scope.organizationId } } });
  if (!group) {
    throw new NotFoundException("Guruh topilmadi");
  }
  if (group.branchId !== branchId) {
    throw new ForbiddenException("Bu guruhga kirish huquqingiz yo'q");
  }
  await assertTeacherOwnsGroup(prisma, scope, group.id);
  return group.id;
}

/** Ota-onaning bolalari qaysi filial va guruhlarda */
export async function parentChildrenScope(
  prisma: PrismaService,
  parent: AuthenticatedParent,
): Promise<{ branchIds: string[]; groupIds: string[] }> {
  const links = await prisma.childGuardian.findMany({
    where: { guardianId: parent.id, child: { organizationId: parent.organizationId } },
    select: { child: { select: { branchId: true, groupId: true } } },
  });
  return {
    branchIds: Array.from(new Set(links.map((link) => link.child.branchId))),
    groupIds: Array.from(new Set(links.map((link) => link.child.groupId).filter((id): id is string => Boolean(id)))),
  };
}

/** `data:image/...;base64,...` ni baytlarga aylantiradi (DTO formatni oldin tekshiradi) */
export function decodeImageDataUrl(dataUrl: string, maxBytes: number): { buffer: Buffer; mimeType: string } {
  const [header, base64] = dataUrl.split(",", 2);
  const mimeType = header.slice("data:".length, header.indexOf(";"));
  const buffer = Buffer.from(base64 ?? "", "base64");
  if (buffer.byteLength === 0) {
    throw new BadRequestException("Rasm bo'sh");
  }
  if (buffer.byteLength > maxBytes) {
    throw new BadRequestException("Rasm hajmi juda katta");
  }
  return { buffer, mimeType };
}

export const IMAGE_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const IMAGE_DATA_URL_MESSAGE = "Rasm formati qo'llab-quvvatlanmaydi (jpeg, png yoki webp bo'lishi kerak)";

/** Brauzerda 1280px gacha kichraytiriladi — 700 KB yetarli */
export const MAX_CONTENT_IMAGE_BYTES = 700 * 1024;
