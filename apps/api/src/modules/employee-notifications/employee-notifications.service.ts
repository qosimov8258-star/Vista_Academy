import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope } from "../iam/tenant-auth.types";

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

  async markAllRead(scope: TenantScope) {
    const employee = await this.findOwnEmployee(scope);
    if (!employee) return { count: 0 };
    return this.prisma.employeeNotification.updateMany({
      where: { employeeId: employee.id, isRead: false },
      data: { isRead: true },
    });
  }
}
