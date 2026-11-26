import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";
import { parseParentMessage } from "../parent/parent-messages";

/** Admin qo'ng'iroqchasida ko'rsatiladigan ota-ona xabarlari muddati */
const PARENT_MESSAGES_WINDOW_MS = 48 * 60 * 60 * 1000;
const PARENT_MESSAGES_LIMIT = 50;

export interface ParentMessageItem {
  /** Barqaror kalit — guruhning bir nechta tarbiyachisiga yozilgan nusxalardan birinchisi */
  id: string;
  kind: "NOTE" | "DEPARTURE";
  branchId: string;
  /** Bola filialda nomi bo'yicha topilsa — havola uchun; bir xil ismli ikki bola bo'lsa `null` */
  childId: string | null;
  childName: string;
  parentName: string;
  text: string | null;
  minutes: number | null;
  createdAt: Date;
}

/**
 * Xodimning o'z bildirishnomalari — faqat tizimga kabinet bilan kirgan
 * xodimda (masalan o'qituvchi) ma'no bildiradi. Login xodim kartochkasiga
 * bog'lanmagan bo'lsa (Super Admin, moliyachi), bo'sh ro'yxat qaytadi.
 */
@Injectable()
export class EmployeeNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOwnEmployee(scope: TenantScope) {
    return this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId } });
  }

  async findMine(scope: TenantScope) {
    const employee = await this.findOwnEmployee(scope);
    if (!employee) return [];
    return this.prisma.employeeNotification.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async markRead(scope: TenantScope, id: string) {
    const employee = await this.findOwnEmployee(scope);
    const notification = employee
      ? await this.prisma.employeeNotification.findFirst({ where: { id, employeeId: employee.id } })
      : null;
    if (!notification) {
      throw new NotFoundException("Bildirishnoma topilmadi");
    }
    return this.prisma.employeeNotification.update({ where: { id }, data: { isRead: true } });
  }

  /**
   * Admin (Super Admin, filial admini) uchun: so'nggi 48 soatda ota-onalar
   * kabinetdan yuborgan eslatma va «yo'lga chiqdim» xabarlari. Ular guruh
   * tarbiyachilariga bildirishnoma sifatida yoziladi (har tarbiyachiga bitta
   * nusxa) — bu yerda nusxalar bittaga yig'iladi. Filial admini faqat o'z
   * filialini, Super Admin `branchId` bilan bitta filialni yoki hammasini ko'radi.
   */
  async parentMessages(scope: TenantScope, branchIdParam?: string): Promise<ParentMessageItem[]> {
    if (scope.role !== "NETWORK_ADMIN" && scope.role !== "BRANCH_ADMIN") {
      throw new ForbiddenException("Faqat Super Admin va filial admini uchun");
    }
    const branchId = scope.branchId ?? branchIdParam ?? null;
    if (branchId && !scope.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId }, select: { id: true } });
      if (!branch) throw new NotFoundException("Filial topilmadi");
    }

    const rows = await this.prisma.employeeNotification.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - PARENT_MESSAGES_WINDOW_MS) },
        ...(branchId ? { branchId } : { branch: { organizationId: scope.organizationId } }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 500,
      select: { id: true, branchId: true, message: true, createdAt: true },
    });

    // Bir xabar guruhning har tarbiyachisiga alohida yoziladi — bittaga yig'amiz
    const seen = new Set<string>();
    const parsed: (Omit<ParentMessageItem, "childId">)[] = [];
    for (const row of rows) {
      const message = parseParentMessage(row.message);
      if (!message) continue;
      const dedupe = `${row.branchId}|${row.createdAt.toISOString()}|${row.message}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      parsed.push({
        id: row.id,
        kind: message.kind,
        branchId: row.branchId,
        childName: message.childName,
        parentName: message.parentName,
        text: message.kind === "NOTE" ? message.text : null,
        minutes: message.kind === "DEPARTURE" ? message.minutes : null,
        createdAt: row.createdAt,
      });
      if (parsed.length >= PARENT_MESSAGES_LIMIT) break;
    }
    if (parsed.length === 0) return [];

    // Bola sahifasiga havola uchun — filial ichida ismi bo'yicha (bir xil ismlilar bo'lsa havolasiz)
    const children = await this.prisma.child.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: { in: [...new Set(parsed.map((p) => p.branchId))] },
        fullName: { in: [...new Set(parsed.map((p) => p.childName))] },
      },
      select: { id: true, branchId: true, fullName: true },
    });
    const byName = new Map<string, string | null>();
    for (const child of children) {
      const key = `${child.branchId}|${child.fullName}`;
      byName.set(key, byName.has(key) ? null : child.id);
    }
    return parsed.map((p) => ({ ...p, childId: byName.get(`${p.branchId}|${p.childName}`) ?? null }));
  }

  async markAllRead(scope: TenantScope) {
    const employee = await this.findOwnEmployee(scope);
    if (!employee) return { count: 0 };
    return this.prisma.employeeNotification.updateMany({
      where: { employeeId: employee.id, isRead: false },
      data: { isRead: true },
    });
  }
}
