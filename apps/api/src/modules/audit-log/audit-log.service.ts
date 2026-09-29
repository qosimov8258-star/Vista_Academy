import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { AuditLogFilterDto, AuditLogQueryDto } from "./dto/audit-log-query.dto";

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
    const where = this.buildWhere(caller, query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        // Tarmoq bo'yicha ko'rinishda har bir yozuv qaysi filialda bo'lgani ko'rsatiladi
        include: { branch: { select: { name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  /**
   * Filtr uchun: shu doirada amal bajargan kishilar va nechta amal qilgani.
   * Xodim tizimdan o'chirilgan bo'lsa ham ismi jurnalda qolgani uchun
   * ro'yxatda chiqadi (actorName yozuvning o'zida saqlanadi).
   */
  async actors(caller: TenantAuthenticatedUser, filter: AuditLogFilterDto) {
    const where = this.buildWhere(caller, { ...filter, actorUserId: undefined });
    const rows = await this.prisma.auditLog.groupBy({
      by: ["actorUserId", "actorName"],
      where,
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 100,
    });
    return rows.map((r) => ({ actorUserId: r.actorUserId, actorName: r.actorName, count: r._count._all }));
  }

  private buildWhere(caller: TenantAuthenticatedUser, filter: AuditLogFilterDto): Prisma.AuditLogWhereInput {
    if (caller.role !== "NETWORK_ADMIN" && caller.role !== "BRANCH_ADMIN") {
      throw new ForbiddenException("Sizda faoliyat jurnalini ko'rish huquqi yo'q");
    }
    const entityTypes = filter.entityTypes
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const q = filter.q?.trim();
    // Kun chegaralari Toshkent vaqti bilan — server qaysi mintaqada bo'lishidan qat'i nazar
    const from = filter.from ? new Date(`${filter.from}T00:00:00+05:00`) : undefined;
    const to = filter.to ? new Date(new Date(`${filter.to}T00:00:00+05:00`).getTime() + 24 * 60 * 60 * 1000) : undefined;

    return {
      organizationId: caller.organizationId,
      // Filial admini faqat o'z filialini ko'radi — so'rovdagi branchId e'tiborga olinmaydi
      branchId: caller.role === "NETWORK_ADMIN" ? filter.branchId : caller.branchId,
      actorUserId: filter.actorUserId,
      entityType: entityTypes?.length ? { in: entityTypes } : undefined,
      createdAt: from || to ? { gte: from, lt: to } : undefined,
      OR: q
        ? [
            { summary: { contains: q, mode: "insensitive" } },
            { actorName: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    };
  }
}
