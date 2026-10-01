import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../../database/prisma.service";
import { AGENT_KEY_PREFIX, hashAgentToken } from "./agent-token";

/** Agent so'roviga biriktiriladigan qurilma — faqat kerakli maydonlar. */
export interface AgentDevice {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
}

/** Ulangan obyekt agenti (hka_ kaliti bilan). */
export interface AgentKeyOwner {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
}

export type AgentRequest = Request & { agentDevice?: AgentDevice; agentKeyOwner?: AgentKeyOwner };

/** Qurilma tanlanadigan sarlavha — agent kaliti bilan ishlaganda. */
export const AGENT_DEVICE_HEADER = "x-face-id-device";

/** Agent "onlayn" belgisini har so'rovda emas, shu oraliqda bir marta yangilaymiz. */
const AGENT_SEEN_THROTTLE_MS = 30_000;

/**
 * hka_ kalitini tekshiradi: bekor qilinmagan agent. lastSeenAt ni ham yangilaydi.
 * Kalit hech qachon logga yoki xato matniga qo'shilmaydi.
 */
export async function resolveAgentKey(prisma: PrismaService, key: string): Promise<AgentKeyOwner> {
  const agent = await prisma.faceIdAgent.findUnique({
    where: { keyHash: hashAgentToken(key) },
    select: { id: true, organizationId: true, branchId: true, name: true, revokedAt: true, lastSeenAt: true },
  });
  if (!agent || agent.revokedAt) {
    throw new UnauthorizedException("Agent kaliti noto'g'ri yoki uzilgan — agentni qayta ulang");
  }
  if (!agent.lastSeenAt || Date.now() - agent.lastSeenAt.getTime() > AGENT_SEEN_THROTTLE_MS) {
    await prisma.faceIdAgent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
  }
  return { id: agent.id, organizationId: agent.organizationId, branchId: agent.branchId, name: agent.name };
}

function bearer(request: Request): string {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedException("Agent tokeni berilmagan");
  }
  return token;
}

/** `/agent/devices` kabi faqat ulangan agent (hka_) uchun yo'llar. */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const key = bearer(request);
    if (!key.startsWith(AGENT_KEY_PREFIX)) {
      throw new UnauthorizedException("Bu yo'l uchun ulangan agent kaliti kerak");
    }
    request.agentKeyOwner = await resolveAgentKey(this.prisma, key);
    return true;
  }
}

/**
 * `/agent/*` so'rovlari uchun: `Authorization: Bearer <agentToken>` (bitta qurilma
 * tokeni) yoki `Bearer hka_...` + `X-Face-Id-Device: <id>` (ulangan obyekt agenti).
 * Token qurilmaga bog'langan; o'chirilgan (INACTIVE) qurilma tokeni rad
 * etiladi. Token hech qachon logga yoki xato matniga qo'shilmaydi.
 */
@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const token = bearer(request);
    // Ulangan agent: bitta kalit + qaysi qurilma ekani sarlavhada. Qurilma
    // shu agent filialiniki bo'lishi shart (boshqa filial/tashkilot emas).
    if (token.startsWith(AGENT_KEY_PREFIX)) {
      const owner = await resolveAgentKey(this.prisma, token);
      const deviceId = String(request.headers[AGENT_DEVICE_HEADER] ?? "");
      const device = deviceId
        ? await this.prisma.faceIdDevice.findFirst({
            where: { id: deviceId, organizationId: owner.organizationId, branchId: owner.branchId },
            select: { id: true, organizationId: true, branchId: true, name: true, status: true },
          })
        : null;
      if (!device) {
        throw new UnauthorizedException("Qurilma topilmadi yoki bu agent filialiga tegishli emas");
      }
      if (device.status === "INACTIVE") {
        throw new ForbiddenException("Qurilma o'chirilgan");
      }
      request.agentKeyOwner = owner;
      request.agentDevice = { id: device.id, organizationId: device.organizationId, branchId: device.branchId, name: device.name };
      return true;
    }
    const device = await this.prisma.faceIdDevice.findUnique({
      where: { agentTokenHash: hashAgentToken(token) },
      select: { id: true, organizationId: true, branchId: true, name: true, status: true },
    });
    if (!device) {
      throw new UnauthorizedException("Agent tokeni noto'g'ri yoki bekor qilingan");
    }
    if (device.status === "INACTIVE") {
      throw new ForbiddenException("Qurilma o'chirilgan");
    }
    request.agentDevice = { id: device.id, organizationId: device.organizationId, branchId: device.branchId, name: device.name };
    return true;
  }
}
