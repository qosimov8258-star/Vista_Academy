import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../database/prisma.service";
import { signPlatformEntryTicket } from "../iam/platform-entry-ticket";
import type { AuthenticatedUser } from "../auth/auth.types";

/**
 * Platforma operatorining bog'cha bilan ishlashi: foydalanish va tarif
 * limitlari, sabab bilan to'xtatish, arxiv (qattiq o'chirish o'rniga) va
 * "Bog'chaga kirish".
 */
@Injectable()
export class OrganizationLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Bog'cha sahifasi: tarif limitlariga nisbatan foydalanish, filiallar, administratorlar. */
  async getUsage(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, subscription: { select: { plan: true } } },
    });
    if (!organization) throw new NotFoundException("Bog'cha topilmadi");

    const [children, employees, staffAccounts, guardians, groups, branches, admins, lastLogin] = await Promise.all([
      this.prisma.child.count({ where: { organizationId: id, status: "ACTIVE" } }),
      this.prisma.employee.count({ where: { organizationId: id, isActive: true } }),
      this.prisma.tenantUser.count({ where: { organizationId: id, isActive: true } }),
      this.prisma.guardian.count({ where: { organizationId: id } }),
      this.prisma.group.count({ where: { branch: { organizationId: id } } }),
      this.prisma.branch.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          createdAt: true,
          _count: {
            select: {
              children: { where: { status: "ACTIVE" } },
              employees: { where: { isActive: true } },
              groups: true,
            },
          },
        },
      }),
      this.prisma.tenantUser.findMany({
        where: { organizationId: id, role: "NETWORK_ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true, login: true, fullName: true, isActive: true, lastLoginAt: true },
      }),
      this.prisma.tenantUser.aggregate({ where: { organizationId: id }, _max: { lastLoginAt: true } }),
    ]);

    const plan = organization.subscription?.plan ?? null;
    return {
      plan: plan
        ? {
            name: plan.name,
            maxBranches: plan.maxBranches,
            maxChildren: plan.maxChildren,
            maxEmployees: plan.maxEmployees,
            maxStorageGb: plan.maxStorageGb,
          }
        : null,
      counts: { branches: branches.length, children, employees, staffAccounts, guardians, groups },
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        createdAt: branch.createdAt,
        children: branch._count.children,
        employees: branch._count.employees,
        groups: branch._count.groups,
      })),
      admins,
      lastLoginAt: lastLogin._max.lastLoginAt,
    };
  }

  async suspend(id: string, reason: string | undefined) {
    const organization = await this.requireOrganization(id);
    if (organization.status === "ARCHIVED") {
      throw new BadRequestException("Bog'cha arxivda — avval arxivdan qaytaring");
    }
    return this.prisma.organization.update({
      where: { id },
      data: { status: "SUSPENDED", suspendReason: reason?.trim() || null, suspendedAt: new Date() },
    });
  }

  async activate(id: string) {
    const organization = await this.requireOrganization(id);
    if (organization.status === "ARCHIVED") {
      throw new BadRequestException("Bog'cha arxivda — avval arxivdan qaytaring");
    }
    return this.prisma.organization.update({
      where: { id },
      data: { status: "ACTIVE", suspendReason: null, suspendedAt: null },
    });
  }

  /**
   * Arxiv — qattiq o'chirish o'rniga: panel va ota-ona kabineti yopiladi,
   * ro'yxatlardan yashiriladi, ma'lumot joyida qoladi.
   */
  async archive(id: string, confirmSlug: string) {
    const organization = await this.requireOrganization(id);
    if (confirmSlug.trim().toLowerCase() !== organization.slug) {
      throw new BadRequestException("Tasdiqlash uchun bog'cha manzilini (slug) aynan yozing");
    }
    if (organization.status === "ARCHIVED") return organization;
    return this.prisma.organization.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
  }

  /** Arxivdan qaytarish — avvalgi to'xtatish sababi bo'lsa to'xtatilgan holatga, aks holda faol. */
  async restore(id: string) {
    const organization = await this.requireOrganization(id);
    if (organization.status !== "ARCHIVED") {
      throw new BadRequestException("Bog'cha arxivda emas");
    }
    return this.prisma.organization.update({
      where: { id },
      data: { status: organization.suspendedAt ? "SUSPENDED" : "ACTIVE", archivedAt: null },
    });
  }

  /**
   * "Bog'chaga kirish": bog'chaning birinchi faol Super Admin hisobi nomidan
   * 60 soniyalik bir martalik chipta. Panel uni 30 daqiqalik seansga
   * almashtiradi va bog'cha audit jurnaliga yozadi.
   */
  async createEntryTicket(id: string, operator: AuthenticatedUser) {
    const organization = await this.requireOrganization(id);
    if (organization.status !== "ACTIVE") {
      throw new BadRequestException("Bog'cha faol emas — kirish uchun avval faollashtiring");
    }
    const admin = await this.prisma.tenantUser.findFirst({
      where: { organizationId: id, role: "NETWORK_ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!admin) {
      throw new BadRequestException("Bog'chada faol Super Admin hisobi yo'q");
    }
    const ticket = signPlatformEntryTicket(this.jwt, {
      sub: admin.id,
      organizationId: id,
      operatorId: operator.id,
      operatorName: operator.fullName || operator.login,
    });
    return { ticket, slug: organization.slug };
  }

  private async requireOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id } });
    if (!organization) throw new NotFoundException("Bog'cha topilmadi");
    return organization;
  }
}
