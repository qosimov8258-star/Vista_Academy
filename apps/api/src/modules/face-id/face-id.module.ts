import { Module } from "@nestjs/common";
import { FaceIdController } from "./face-id.controller";
import { FaceIdService } from "./face-id.service";
import { FaceIdAgentController } from "./face-id-agent.controller";
import { FaceIdAgentService } from "./face-id-agent.service";
import { FaceIdCommandsService } from "./face-id-commands.service";
import { AgentTokenGuard } from "./agent/agent-token.guard";

@Module({
  controllers: [FaceIdController, FaceIdAgentController],
  providers: [FaceIdService, FaceIdAgentService, FaceIdCommandsService, AgentTokenGuard],
  exports: [FaceIdService, FaceIdCommandsService],
})
export class FaceIdModule {}
