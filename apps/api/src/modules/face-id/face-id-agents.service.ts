import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { existsSync, statSync } from "fs";
import path from "path";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { generateAgentKey, generatePairingCode, hashAgentToken, hashPairingCode } from "./agent/agent-token";
import type { AgentKeyOwner } from "./agent/agent-token.guard";

/** O'rnatuvchi turlari: release/ dagi fayl va yuklab olishdagi nom (nomida ulash kodi). */
export const AGENT_INSTALLERS = {
  windows: { file: "zeeron-agent-win-x64.exe", name: (code: string) => `zeeron-agent-${code}.exe` },
  "macos-arm64": { file: "Zeeron-Agent-macos-arm64.pkg", name: (code: string) => `Zeeron-Agent-${code}.pkg` },
  "macos-x64": { file: "Zeeron-Agent-macos-x64.pkg", name: (code: string) => `Zeeron-Agent-${code}.pkg` },
} as const;
export type AgentInstallerPlatform = keyof typeof AGENT_INSTALLERS;

/** Yuklab olish havolasi amal qilish muddati (kodning o'zi 15 daqiqa). */
const INSTALLER_LINK_TTL_MS = 5 * 60 * 1000;

/** hik-agent/scripts/build-installers.sh natijalari serverda shu papkada. */
function installerBuildsDir(): string {
  if (process.env.FACE_ID_AGENT_BUILDS_DIR) return process.env.FACE_ID_AGENT_BUILDS_DIR;
  const shared = "/srv/vista/shared/agent-builds";
  return existsSync(shared) ? shared : path.join(process.cwd(), "agent-builds");
}

function linkSecret(): string {
  const secret = process.env.JWT_TENANT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_TENANT_ACCESS_SECRET berilmagan");
  return `face-id-installer:${secret}`;
}

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

  /**
   * "Agentni o'rnatish": yangi ulash kodi + 5 daqiqalik imzolangan yuklab olish
   * havolasi. O'rnatuvchi fayl nomida kod bo'ladi — agent uni o'zi o'qiydi,
   * bog'chadagi kompyuterda hech narsa yozilmaydi.
   */
  async createInstallerLink(caller: TenantAuthenticatedUser, platform: string) {
    if (!(platform in AGENT_INSTALLERS)) {
      throw new BadRequestException("Noma'lum tizim: windows, macos-arm64 yoki macos-x64");
    }
    const installer = AGENT_INSTALLERS[platform as AgentInstallerPlatform];
    if (!existsSync(path.join(installerBuildsDir(), installer.file))) {
      throw new NotFoundException("O'rnatuvchi serverga hali yuklanmagan — administratorga murojaat qiling");
    }
    const { code, expiresAt } = await this.createPairingCode(caller);
    const payload = Buffer.from(JSON.stringify({ c: code, p: platform, e: Date.now() + INSTALLER_LINK_TTL_MS })).toString("base64url");
    const signature = createHmac("sha256", linkSecret()).update(payload).digest("base64url");
    return { path: `/agent/installer/${payload}.${signature}`, code, expiresAt };
  }

  /** Imzolangan havola bo'yicha o'rnatuvchi fayl va yuklab olishdagi nomi. */
  resolveInstallerLink(token: string): { filePath: string; downloadName: string; size: number } {
    const invalid = new NotFoundException("Havola eskirgan yoki noto'g'ri — ERP'dan qaytadan yuklab oling");
    const [payload, signature] = token.split(".");
    if (!payload || !signature) throw invalid;
    const expected = createHmac("sha256", linkSecret()).update(payload).digest();
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid;
    let data: { c: string; p: string; e: number };
    try {
      data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw invalid;
    }
    if (!(data.p in AGENT_INSTALLERS) || data.e < Date.now()) throw invalid;
    const installer = AGENT_INSTALLERS[data.p as AgentInstallerPlatform];
    const filePath = path.join(installerBuildsDir(), installer.file);
    if (!existsSync(filePath)) throw invalid;
    return { filePath, downloadName: installer.name(data.c), size: statSync(filePath).size };
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
