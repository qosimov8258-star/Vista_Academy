import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationEventType, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireBranchScope } from "../iam/tenant-auth.types";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { MarkNotificationSentDto } from "./dto/mark-notification-sent.dto";
import { NotificationQueryDto } from "./dto/notification-query.dto";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: TenantAuthenticatedUser, dto: CreateNotificationDto) {
    const scope = { organizationId: user.organizationId, branchId: user.branchId };
    const branchId = requireBranchScope(scope);
    if (dto.childId) {
      const child = await this.prisma.child.findFirst({ where: { id: dto.childId, organizationId: scope.organizationId } });
      if (!child || child.branchId !== branchId) {
        throw new NotFoundException("Bola topilmadi");
      }
    }
    return this.prisma.notificationLog.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        childId: dto.childId,
        eventType: dto.eventType,
        recipientName: dto.recipientName,
        recipientContact: dto.recipientContact,
        message: dto.message,
      },
    });
  }

  async findAll(scope: TenantScope, query: NotificationQueryDto) {
    const where: Prisma.NotificationLogWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);
    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  async markSent(user: TenantAuthenticatedUser, id: string, dto: MarkNotificationSentDto) {
    const scope = { organizationId: user.organizationId, branchId: user.branchId };
    const branchId = requireBranchScope(scope);
    const log = await this.prisma.notificationLog.findFirst({ where: { id, organizationId: scope.organizationId } });
    if (!log) {
      throw new NotFoundException("Bildirishnoma topilmadi");
    }
    if (log.branchId !== branchId) {
      throw new ForbiddenException("Bu bildirishnomaga kirish huquqingiz yo'q");
    }
    return this.prisma.notificationLog.update({
      where: { id },
      data: { status: "SENT", channel: dto.channel, sentByUserId: user.id, sentAt: new Date() },
    });
  }

  countPending(scope: TenantScope) {
    return this.prisma.notificationLog.count({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? undefined, status: "PENDING" },
    });
  }

  /**
   * Internal, called from other modules when a notification-worthy event
   * happens (e.g. a child marked absent). Not exposed as its own endpoint —
   * always logged as PENDING since there's no real dispatch provider here.
   */
  async logSystemEvent(params: {
    organizationId: string;
    branchId: string;
    childId?: string;
    eventType: NotificationEventType;
    recipientName: string;
    message: string;
  }) {
    return this.prisma.notificationLog.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.branchId,
        childId: params.childId,
        eventType: params.eventType,
        recipientName: params.recipientName,
        message: params.message,
      },
    });
  }
}
