import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { disabledFeatureKeys } from "../../common/features/feature-catalog";
import { ORGANIZATION_WITH_SUBSCRIPTION_FEATURES, isOrganizationSuspended, ORGANIZATION_SUSPENDED_MESSAGE } from "../iam/organization-access";
import { consumeTicketId, ENTRY_TICKET_TTL_SECONDS } from "../iam/platform-entry-ticket";
import type { TenantAuthenticatedUser } from "../iam/tenant-auth.types";
import { requireParentAccessSecret } from "./parent-auth.service";
import type { AuthenticatedParent } from "./parent-auth.types";

/**
 * «Ota-ona profiliga kirish» — xodimnikidek: Super Admin yoki filial admini
 * «Ota-onalar» bo'limidan ota-ona kabinetiga, o'sha ota-ona o'zi kirgandek
 * kiradi. Qisqa muddatli bir martalik chipta → yangi tab `/ota-ona/{slug}/enter#t=`
 * → `POST /app/parent/enter` → ota-ona seansi. Kirish bog'cha audit jurnaliga yoziladi.
 */
const PARENT_ENTRY_PURPOSE = "parent-entry";
const ENTRY_ROLES: ReadonlySet<string> = new Set(["NETWORK_ADMIN", "BRANCH_ADMIN"]);

interface ParentEntryTicketPayload {
  purpose: typeof PARENT_ENTRY_PURPOSE;
  /** Kiriladigan ota-ona (Guardian.id) */
  sub: string;
  organizationId: string;
  /** Filial admini bo'lsa — uning filiali (Super Admin uchun null) */
  branchId: string | null;
  operatorId: string;
  operatorName: string;
  jti: string;
  exp: number;
}

/** Chipta ota-ona yoki xodim tokeni bilan adashmasligi uchun alohida kalit */
function entrySecret(): string {
  return `parent-entry:${requireParentAccessSecret()}`;
}

@Injectable()
export class ParentEntryService {
  private readonly logger = new Logger(ParentEntryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Ota-ona kabineti shu bog'cha uchun («Ota-onalar» panelida) yoqilganmi */
  private async assertCabinetEnabled(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, include: ORGANIZATION_WITH_SUBSCRIPTION_FEATURES });
    if (!org) throw new NotFoundException("Bog'cha topilmadi");
    if (isOrganizationSuspended(org, org.subscription)) throw new ForbiddenException(ORGANIZATION_SUSPENDED_MESSAGE);
    const disabled = disabledFeatureKeys(org.subscription?.plan.features, org.featureOverrides, "PARENT", org.panelFeatureOverrides);
    if (disabled.includes("parentCabinet")) throw new ForbiddenException("Bog'chada ota-ona kabineti yoqilmagan");
    return org;
  }

  /** Ota-ona shu bog'chada, faol, kabineti ochilgan va (filial admini uchun) uning filialida bolasi bor */
  private async findGuardian(guardianId: string, organizationId: string, branchId: string | null) {
    return this.prisma.guardian.findFirst({
      where: {
        id: guardianId,
        organizationId,
        isActive: true,
        ...(branchId ? { children: { some: { child: { branchId } } } } : {}),
      },
      // passwordHash global omit qilingan — kabinet ochilganini bilish uchun kerak
      omit: { passwordHash: false },
    });
  }

  async issueTicket(caller: TenantAuthenticatedUser, guardianId: string) {
    if (!ENTRY_ROLES.has(caller.role)) {
      throw new ForbiddenException("Ota-ona kabinetiga faqat Super Admin yoki filial admini kira oladi");
    }
    await this.assertCabinetEnabled(caller.organizationId);
    const guardian = await this.findGuardian(guardianId, caller.organizationId, caller.branchId);
    if (!guardian) throw new NotFoundException("Ota-ona topilmadi");
    if (!guardian.passwordHash) throw new BadRequestException("Bu ota-onaga hali kabinet ochilmagan");
    const ticket = this.jwt.sign(
      {
        purpose: PARENT_ENTRY_PURPOSE,
        sub: guardian.id,
        organizationId: caller.organizationId,
        branchId: caller.branchId,
        operatorId: caller.id,
        operatorName: caller.fullName,
        jti: randomUUID(),
      },
      { secret: entrySecret(), expiresIn: ENTRY_TICKET_TTL_SECONDS },
    );
    return { ticket };
  }

  /**
   * Chipta berilgandan keyin ham hamma shart qayta tekshiriladi: ota-ona hali
   * faol va kabineti ochiq, kirgan admin hali faol va huquqi bor, kabinet yoqilgan.
   */
  async enter(ticket: string): Promise<AuthenticatedParent> {
    let payload: ParentEntryTicketPayload;
    try {
      payload = this.jwt.verify(ticket, { secret: entrySecret() });
    } catch {
      throw new UnauthorizedException("Kirish havolasi eskirgan — qaytadan bosing");
    }
    if (payload.purpose !== PARENT_ENTRY_PURPOSE || !payload.jti || !payload.operatorId) {
      throw new UnauthorizedException("Noto'g'ri kirish havolasi");
    }
    if (!consumeTicketId(payload.jti, payload.exp * 1000)) {
      throw new UnauthorizedException("Bu kirish havolasi allaqachon ishlatilgan");
    }
    const org = await this.assertCabinetEnabled(payload.organizationId);
    const [guardian, operator] = await Promise.all([
      this.findGuardian(payload.sub, payload.organizationId, payload.branchId),
      this.prisma.tenantUser.findUnique({ where: { id: payload.operatorId }, select: { role: true, isActive: true, branchId: true, organizationId: true } }),
    ]);
    if (!guardian || !guardian.passwordHash) {
      throw new UnauthorizedException("Ota-ona topilmadi yoki kabineti yopilgan");
    }
    if (
      !operator ||
      !operator.isActive ||
      !ENTRY_ROLES.has(operator.role) ||
      operator.organizationId !== payload.organizationId ||
      (operator.branchId ?? null) !== (payload.branchId ?? null)
    ) {
      throw new ForbiddenException("Kirish huquqi yo'q");
    }

    await this.auditLog.logFromUser(
      { id: payload.operatorId, fullName: payload.operatorName, organizationId: payload.organizationId, branchId: payload.branchId } as TenantAuthenticatedUser,
      {
        action: "parent.enter",
        entityType: "Guardian",
        entityId: guardian.id,
        summary: `${payload.operatorName} ota-ona ${guardian.fullName} kabinetiga kirdi`,
      },
    );
    this.logger.log(`Xodim ${payload.operatorId} ota-ona ${guardian.id} kabinetiga kirdi`);
    // lastLoginAt yangilanmaydi — bu ota-onaning o'z kirishi emas
    return {
      id: guardian.id,
      organizationId: org.id,
      organizationSlug: org.slug,
      organizationName: org.name,
      fullName: guardian.fullName,
      phone: guardian.phone,
      disabledFeatures: [],
    };
  }
}
