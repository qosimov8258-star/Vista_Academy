import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
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

  @ApiBearerAuth()
  @Get("devices")
  @UseGuards(AgentKeyGuard)
  devices(@Req() req: AgentRequest) {
    return this.agentsService.listAgentDevices(req.agentKeyOwner!);
  }
}
