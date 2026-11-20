import { Module } from "@nestjs/common";
import { FaceIdController } from "./face-id.controller";
import { FaceIdService } from "./face-id.service";
import { FaceIdAgentController } from "./face-id-agent.controller";
import { FaceIdAgentService } from "./face-id-agent.service";
import { FaceIdCommandsService } from "./face-id-commands.service";
import { AgentKeyGuard, AgentTokenGuard } from "./agent/agent-token.guard";
import { FaceIdAgentsService } from "./face-id-agents.service";
import { FaceIdAgentPairingController } from "./face-id-agent-pairing.controller";
import { FaceIdGatewayService } from "./gateway/face-id-gateway.service";

@Module({
  controllers: [FaceIdController, FaceIdAgentController, FaceIdAgentPairingController],
  providers: [FaceIdService, FaceIdAgentService, FaceIdCommandsService, FaceIdAgentsService, FaceIdGatewayService, AgentTokenGuard, AgentKeyGuard],
  exports: [FaceIdService, FaceIdCommandsService],
})
export class FaceIdModule {}
