import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { generateAgentKey, generatePairingCode, hashAgentToken, hashPairingCode } from "./agent/agent-token";
import type { AgentKeyOwner } from "./agent/agent-token.guard";

/** Ulash kodi amal qilish muddati. */
const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

const agentSelect = { id: true, name: true, branchId: true, lastSeenAt: true, createdAt: true } as const;

/**
 * Obyekt agentini filialga ulash: ERP bir martalik kod beradi, agent shu kod
 * bilan bir marta ulanib doimiy kalit oladi va keyin filialdagi barcha faol
 * qurilmalarga o'zi xizmat qiladi — har qurilma tokenini .env ga yozish shart emas.
 */
@Injectable()
export class FaceIdAgentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Yangi kod — shu filialning eski ishlatilmagan kodlari bekor bo'ladi. Kod faqat shu javobda ko'rinadi. */
  async createPairingCode(caller: TenantAuthenticatedUser) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.faceIdAgentPairingCode.deleteMany({ where: { branchId, usedAt: null } }),
      this.prisma.faceIdAgentPairingCode.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          codeHash: hashPairingCode(code),
          expiresAt,
          createdByUserId: caller.id,
        },
      }),
    ]);
    return { code, expiresAt };
  }

  listAgents(scope: TenantScope, branchId?: string) {
    return this.prisma.faceIdAgent.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? branchId, revokedAt: null },
      select: agentSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Agentni uzish — kaliti darhol ishlamay qoladi (kompyuter yo'qolsa va h.k.). */
  async revokeAgent(caller: TenantAuthenticatedUser, id: string) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const agent = await this.prisma.faceIdAgent.findFirst({
      where: { id, organizationId: scope.organizationId, branchId, revokedAt: null },
      select: { id: true },
    });
    if (!agent) {
      throw new NotFoundException("Agent topilmadi");
    }
    await this.prisma.faceIdAgent.update({ where: { id }, data: { revokedAt: new Date() } });
    return { id, revoked: true };
  }

  /**
   * Agent tomoni: kod bir marta ishlatiladi (atomar), muddati o'tgan yoki
   * ishlatilgan kod rad etiladi. Xato xabari kod bor-yo'qligini oshkor qilmaydi.
   */
  async pair(code: string, name: string) {
    const invalid = new BadRequestException("Ulash kodi noto'g'ri yoki muddati o'tgan — ERP'da yangisini oling");
    const pairing = await this.prisma.faceIdAgentPairingCode.findUnique({
      where: { codeHash: hashPairingCode(code) },
      include: { organization: { select: { name: true } }, branch: { select: { name: true } } },
    });
    if (!pairing || pairing.usedAt || pairing.expiresAt.getTime() < Date.now()) {
      throw invalid;
    }
    const agentKey = generateAgentKey();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.faceIdAgentPairingCode.updateMany({
        where: { id: pairing.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw invalid;
      }
      await tx.faceIdAgent.create({
        data: {
          organizationId: pairing.organizationId,
          branchId: pairing.branchId,
          name: name.trim() || "hik-agent",
          keyHash: hashAgentToken(agentKey),
          lastSeenAt: new Date(),
        },
      });
    });
    return { agentKey, organizationName: pairing.organization.name, branchName: pairing.branch.name };
  }

  /** Ulangan agent xizmat qiladigan qurilmalar — filialdagi faollari. */
  listAgentDevices(owner: AgentKeyOwner) {
    return this.prisma.faceIdDevice.findMany({
      where: { organizationId: owner.organizationId, branchId: owner.branchId, status: "ACTIVE" },
      select: { id: true, name: true, model: true },
      orderBy: { createdAt: "asc" },
    });
  }
}
