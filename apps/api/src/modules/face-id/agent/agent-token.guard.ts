import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../../database/prisma.service";
import { hashAgentToken } from "./agent-token";

/** Agent so'roviga biriktiriladigan qurilma — faqat kerakli maydonlar. */
export interface AgentDevice {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
}

export type AgentRequest = Request & { agentDevice?: AgentDevice };

/**
 * `/agent/*` so'rovlari uchun: `Authorization: Bearer <agentToken>`.
 * Token qurilmaga bog'langan; o'chirilgan (INACTIVE) qurilma tokeni rad
 * etiladi. Token hech qachon logga yoki xato matniga qo'shilmaydi.
 */
@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const header = request.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Agent tokeni berilmagan");
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
