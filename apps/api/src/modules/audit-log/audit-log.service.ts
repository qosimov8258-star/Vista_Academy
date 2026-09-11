import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

interface LogEntryFromUser {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  /** Amal boshqa filialga tegishli bo'lsa (masalan Super Admin biror filialni tahrirlasa) shu yerdan beriladi — bo'lmasa chaqiruvchining o'z filiali olinadi. */
  branchId?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Amalni tizimga kirgan foydalanuvchi nomidan yozadi — eng ko'p ishlatiladigan shakl. */
  logFromUser(user: TenantAuthenticatedUser, entry: LogEntryFromUser) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        branchId: entry.branchId ?? user.branchId ?? undefined,
        actorUserId: user.id,
        actorName: user.fullName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? undefined,
        summary: entry.summary,
      },
    });
  }

  /** Faoliyat jurnali ro'yxati. Faqat Super Admin va filial admini ko'radi. */
  async findAll(caller: TenantAuthenticatedUser, query: AuditLogQueryDto) {
    if (caller.role !== "NETWORK_ADMIN" && caller.role !== "BRANCH_ADMIN") {
      throw new ForbiddenException("Sizda faoliyat jurnalini ko'rish huquqi yo'q");
    }
    const where: Prisma.AuditLogWhereInput = {
      organizationId: caller.organizationId,
      branchId: caller.role === "NETWORK_ADMIN" ? query.branchId : caller.branchId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }
}
