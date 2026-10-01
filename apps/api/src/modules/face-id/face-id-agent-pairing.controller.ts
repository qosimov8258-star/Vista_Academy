import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { createReadStream } from "fs";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { LoginThrottle } from "../../common/throttle";
import { AgentKeyGuard, type AgentRequest } from "./agent/agent-token.guard";
import { FaceIdAgentsService } from "./face-id-agents.service";
import { PairAgentDto } from "./dto/pair-agent.dto";

/**
 * Obyekt agentini ulash va uning qurilmalar ro'yxati. `pair` ochiq (kod bilan),
 * shuning uchun login kabi urinishlar soni cheklangan.
 */
@ApiTags("Face ID agent")
@Public()
@Controller("agent")
export class FaceIdAgentPairingController {
  constructor(private readonly agentsService: FaceIdAgentsService) {}

  @Post("pair")
  @HttpCode(200)
  @LoginThrottle()
  pair(@Body() dto: PairAgentDto) {
    return this.agentsService.pair(dto.code, dto.name);
  }

  /** O'rnatuvchini yuklab olish — ERP bergan 5 daqiqalik imzolangan havola (fayl nomida ulash kodi). */
  @Get("installer/:token")
  installer(@Param("token") token: string, @Res() res: Response) {
    const file = this.agentsService.resolveInstallerLink(token);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(file.size));
    res.setHeader("Content-Disposition", `attachment; filename="${file.downloadName}"`);
    res.setHeader("Cache-Control", "no-store");
    createReadStream(file.filePath).pipe(res);
  }

  @ApiBearerAuth()
  @Get("devices")
  @UseGuards(AgentKeyGuard)
  devices(@Req() req: AgentRequest) {
    return this.agentsService.listAgentDevices(req.agentKeyOwner!);
  }
}
