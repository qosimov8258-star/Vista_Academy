import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { PushService } from "../push/push.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { BroadcastListQueryDto, BroadcastTargetDto, CreateBroadcastDto } from "./dto/broadcast.dto";

interface ResolvedTarget {
  branchId: string;
  scopeLabel: string;
  guardianIds: string[];
  employeeIds: string[];
  /** Ota-onalar: kabineti hali ochilmaganlar (xabar saqlanadi, kirganda ko'radi) */
  noCabinet: number;
  /** Xodimlar: kabineti (logini) yo'qlar — ularga yetkazib bo'lmaydi, ro'yxatga kirmaydi */
  skipped: number;
  sample: string[];
}

/** Ro'yxat va tarix: Super Admin kuzatadi, filial admini va administrator yuboradi */
const READ_ROLES = new Set(["NETWORK_ADMIN", "BRANCH_ADMIN", "MANAGER"]);

const SAMPLE_SIZE = 5;

/** Xodimlardan xabarni kim o'qiy oladi — «Xabarlar» sahifasi shu rollarda */
const INBOX_ROLES = new Set(["TEACHER", "CHEF"]);

/**
 * Xabar yuborish. Rahbariyat (filial admini, administrator) filial
 * ota-onalariga yoki xodimlariga yozadi; har bir qabul qiluvchi uchun
 * `BroadcastRecipient` qatori ochiladi va o'qilgan vaqti shu yerda saqlanadi.
 * Ota-onaga qo'shimcha brauzer push ham boradi; xodimlar xabarni
 * «Xabarlar» sahifasida ko'radi.
 */
@Injectable()
export class BroadcastsService {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // ---------------------------------------------------------------- yuborish

  async preview(user: TenantAuthenticatedUser, dto: BroadcastTargetDto) {
    const target = await this.resolve(toTenantScope(user), dto);
    return {
      recipients: target.audience === "GUARDIANS" ? target.guardianIds.length : target.employeeIds.length,
      noCabinet: target.noCabinet,
      skipped: target.skipped,
      scopeLabel: target.scopeLabel,
      sample: target.sample,
    };
  }

  async create(user: TenantAuthenticatedUser, dto: CreateBroadcastDto) {
    const scope = toTenantScope(user);
    const target = await this.resolve(scope, dto);
    const ids = target.audience === "GUARDIANS" ? target.guardianIds : target.employeeIds;
    if (ids.length === 0) {
      throw new BadRequestException("Tanlanganlar orasida xabar oladigan hech kim yo'q");
    }

    const broadcast = await this.prisma.$transaction(async (tx) => {
      const created = await tx.broadcast.create({
        data: {
          organizationId: scope.organizationId,
          branchId: target.branchId,
          audience: dto.audience,
          scopeLabel: target.scopeLabel,
          title: dto.title,
          body: dto.body,
          isMandatory: dto.isMandatory ?? false,
          recipientCount: ids.length,
          sentByUserId: user.id,
        },
      });
      await tx.broadcastRecipient.createMany({
        data: ids.map((id) =>
          dto.audience === "GUARDIANS" ? { broadcastId: created.id, guardianId: id } : { broadcastId: created.id, employeeId: id },
        ),
      });
      return created;
    });

    if (dto.audience === "GUARDIANS") {
      // Push xatosi yuborishni to'xtatmaydi — xabar kabinetda baribir turadi
      void this.push
        .sendToGuardians(target.guardianIds, {
          title: dto.title,
          body: dto.body.length > 160 ? `${dto.body.slice(0, 157)}…` : dto.body,
          url: `/ota-ona/${user.organizationSlug}/xabarlar`,
        })
        .catch((error: Error) => this.logger.warn(`Push yuborilmadi: ${error.message}`));
    }

    return { id: broadcast.id, recipients: ids.length, noCabinet: target.noCabinet, skipped: target.skipped };
  }

  /** Kimga borishini aniqlaydi — tekshirish (preview) va yuborishda bir xil */
  private async resolve(scope: TenantScope, dto: BroadcastTargetDto): Promise<ResolvedTarget & { audience: BroadcastTargetDto["audience"] }> {
    const branchId = requireOperationalScope(scope);
    const groupIds = [...new Set(dto.groupIds ?? [])];
    let groupNames: string[] = [];
    if (dto.scope === "GROUPS") {
      if (groupIds.length === 0) throw new BadRequestException("Kamida bitta guruh tanlang");
      const groups = await this.prisma.group.findMany({ where: { id: { in: groupIds }, branchId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
      if (groups.length !== groupIds.length) throw new NotFoundException("Guruh topilmadi");
      groupNames = groups.map((g) => g.name);
    }
    const groupLabel = () =>
      groupNames.length <= 3 ? groupNames.join(", ") : `${groupNames.slice(0, 3).join(", ")} +${groupNames.length - 3}`;

    if (dto.audience === "GUARDIANS") {
      const childIds = [...new Set(dto.childIds ?? [])];
      if (dto.scope === "PICKED" && childIds.length === 0) throw new BadRequestException("Kamida bitta bolani tanlang");
      const children = await this.prisma.child.findMany({
        where: {
          branchId,
          status: { not: "INACTIVE" },
          ...(dto.scope === "GROUPS" ? { groupId: { in: groupIds } } : {}),
          ...(dto.scope === "PICKED" ? { id: { in: childIds } } : {}),
        },
        select: {
          id: true,
          guardians: {
            where: { canReceiveNotifications: true, guardian: { isActive: true } },
            select: { guardian: { select: { id: true, fullName: true, passwordHash: true } } },
          },
        },
      });
      if (dto.scope === "PICKED" && children.length !== childIds.length) throw new NotFoundException("Bola topilmadi");
      // Bir ota-onaning bir nechta bolasi bo'lsa — xabar bir marta
      const guardians = new Map<string, { fullName: string; hasCabinet: boolean }>();
      for (const child of children) {
        for (const link of child.guardians) {
          guardians.set(link.guardian.id, { fullName: link.guardian.fullName, hasCabinet: Boolean(link.guardian.passwordHash) });
        }
      }
      const list = [...guardians.entries()];
      return {
        audience: dto.audience,
        branchId,
        scopeLabel:
          dto.scope === "BRANCH" ? "Butun filial" : dto.scope === "GROUPS" ? groupLabel() : `${children.length} ta bola`,
        guardianIds: list.map(([id]) => id),
        employeeIds: [],
        noCabinet: list.filter(([, g]) => !g.hasCabinet).length,
        skipped: 0,
        sample: list.slice(0, SAMPLE_SIZE).map(([, g]) => g.fullName),
      };
    }

    const employeeIds = [...new Set(dto.employeeIds ?? [])];
    if (dto.scope === "PICKED" && employeeIds.length === 0) throw new BadRequestException("Kamida bitta xodimni tanlang");
    const employees = await this.prisma.employee.findMany({
      where: {
        branchId,
        isActive: true,
        ...(dto.scope === "GROUPS" ? { teachingGroups: { some: { groupId: { in: groupIds } } } } : {}),
        ...(dto.scope === "PICKED" ? { id: { in: employeeIds } } : {}),
      },
      select: { id: true, fullName: true, tenantUserId: true, tenantUser: { select: { role: true } } },
      orderBy: { fullName: "asc" },
    });
    if (dto.scope === "PICKED" && employees.length !== employeeIds.length) throw new NotFoundException("Xodim topilmadi");
    // «Xabarlar» sahifasi tarbiyachi va oshpaz kabinetida bor. Kabineti yo'q
    // yoki rahbariyat xodimi (o'zi ham yuboruvchi) ro'yxatga kirmaydi.
    const reachable = employees.filter((e) => e.tenantUser && INBOX_ROLES.has(e.tenantUser.role) && e.tenantUserId !== scope.userId);
    const self = employees.filter((e) => e.tenantUserId === scope.userId).length;
    return {
      audience: dto.audience,
      branchId,
      scopeLabel:
        dto.scope === "BRANCH" ? "Hamma xodim" : dto.scope === "GROUPS" ? `${groupLabel()} tarbiyachilari` : `${employees.length} ta xodim`,
      guardianIds: [],
      employeeIds: reachable.map((e) => e.id),
      noCabinet: 0,
      skipped: employees.length - reachable.length - self,
      sample: reachable.slice(0, SAMPLE_SIZE).map((e) => e.fullName),
    };
  }

  // ------------------------------------------------------------ tarix

  private readScope(scope: TenantScope) {
    if (!READ_ROLES.has(scope.role)) {
      throw new ForbiddenException("Xabarlar tarixi faqat rahbariyatga ochiq");
    }
    return { organizationId: scope.organizationId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  }

  async list(user: TenantAuthenticatedUser, query: BroadcastListQueryDto, branchId?: string) {
    const scope = toTenantScope(user);
    const where = { ...this.readScope(scope), ...(!scope.branchId && branchId ? { branchId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          audience: true,
          scopeLabel: true,
          title: true,
          body: true,
          isMandatory: true,
          recipientCount: true,
          createdAt: true,
          sentBy: { select: { fullName: true } },
          branch: { select: { name: true } },
        },
      }),
      this.prisma.broadcast.count({ where }),
    ]);
    const reads = items.length
      ? await this.prisma.broadcastRecipient.groupBy({
          by: ["broadcastId"],
          where: { broadcastId: { in: items.map((i) => i.id) }, readAt: { not: null } },
          _count: { _all: true },
        })
      : [];
    const readBy = new Map(reads.map((r) => [r.broadcastId, r._count._all]));
    return {
      data: items.map((item) => ({ ...item, readCount: readBy.get(item.id) ?? 0 })),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async detail(user: TenantAuthenticatedUser, id: string) {
    const scope = toTenantScope(user);
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, ...this.readScope(scope) },
      select: {
        id: true,
        branchId: true,
        audience: true,
        scopeLabel: true,
        title: true,
        body: true,
        isMandatory: true,
        recipientCount: true,
        createdAt: true,
        sentBy: { select: { fullName: true } },
        branch: { select: { name: true } },
        recipients: {
          select: {
            id: true,
            readAt: true,
            guardian: {
              select: {
                fullName: true,
                phone: true,
                passwordHash: true,
                children: { select: { child: { select: { fullName: true, branchId: true } } } },
              },
            },
            employee: { select: { fullName: true, position: true } },
          },
        },
      },
    });
    if (!broadcast) throw new NotFoundException("Xabar topilmadi");

    const recipients = broadcast.recipients
      .map((r) =>
        r.guardian
          ? {
              id: r.id,
              name: r.guardian.fullName,
              phone: r.guardian.phone,
              note: r.guardian.children
                .filter((c) => c.child.branchId === broadcast.branchId)
                .map((c) => c.child.fullName)
                .join(", "),
              hasCabinet: Boolean(r.guardian.passwordHash),
              readAt: r.readAt,
            }
          : {
              id: r.id,
              name: r.employee?.fullName ?? "—",
              phone: null,
              note: r.employee?.position ?? "",
              hasCabinet: true,
              readAt: r.readAt,
            },
      )
      // O'qimaganlar tepada — admin kimga qo'ng'iroq qilishni ko'radi
      .sort((a, b) => Number(Boolean(a.readAt)) - Number(Boolean(b.readAt)) || a.name.localeCompare(b.name));

    const { recipients: _raw, branchId: _branch, ...rest } = broadcast;
    return { ...rest, readCount: recipients.filter((r) => r.readAt).length, recipients };
  }

  // ------------------------------------------------- xodimning o'z xabarlari

  private async ownEmployeeId(scope: TenantScope) {
    const employee = await this.prisma.employee.findUnique({ where: { tenantUserId: scope.userId }, select: { id: true } });
    return employee?.id ?? null;
  }

  async employeeInbox(user: TenantAuthenticatedUser) {
    const employeeId = await this.ownEmployeeId(toTenantScope(user));
    if (!employeeId) return [];
    return this.inbox({ employeeId });
  }

  async employeeMarkRead(user: TenantAuthenticatedUser, id: string) {
    const employeeId = await this.ownEmployeeId(toTenantScope(user));
    if (!employeeId) throw new NotFoundException("Xabar topilmadi");
    return this.markRead({ employeeId }, id);
  }

  async employeeMarkAllRead(user: TenantAuthenticatedUser) {
    const employeeId = await this.ownEmployeeId(toTenantScope(user));
    if (!employeeId) return { count: 0 };
    return this.markAllRead({ employeeId });
  }

  // ------------------------------------------------- ota-onaning xabarlari

  guardianInbox(guardianId: string) {
    return this.inbox({ guardianId });
  }

  guardianMarkRead(guardianId: string, id: string) {
    return this.markRead({ guardianId }, id);
  }

  guardianMarkAllRead(guardianId: string) {
    return this.markAllRead({ guardianId });
  }

  // ------------------------------------------------------------ umumiy

  private async inbox(owner: { guardianId: string } | { employeeId: string }) {
    const rows = await this.prisma.broadcastRecipient.findMany({
      where: owner,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        readAt: true,
        createdAt: true,
        broadcast: { select: { title: true, body: true, isMandatory: true, branch: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.broadcast.title,
      body: r.broadcast.body,
      isMandatory: r.broadcast.isMandatory,
      from: r.broadcast.branch.name,
      readAt: r.readAt,
      createdAt: r.createdAt,
    }));
  }

  private async markRead(owner: { guardianId: string } | { employeeId: string }, id: string) {
    const result = await this.prisma.broadcastRecipient.updateMany({ where: { id, ...owner, readAt: null }, data: { readAt: new Date() } });
    if (result.count === 0) {
      const exists = await this.prisma.broadcastRecipient.count({ where: { id, ...owner } });
      if (!exists) throw new NotFoundException("Xabar topilmadi");
    }
    return { success: true };
  }

  /** «Hammasini o'qish» majburiy xabarlarga tegmaydi — ular faqat ochib o'qilganda belgilanadi */
  private async markAllRead(owner: { guardianId: string } | { employeeId: string }) {
    const result = await this.prisma.broadcastRecipient.updateMany({
      where: { ...owner, readAt: null, broadcast: { isMandatory: false } },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }
}
