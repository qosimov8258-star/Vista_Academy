import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AgentDevice, AgentRequest } from "./agent-token.guard";

/** `AgentTokenGuard` aniqlagan qurilma. */
export const CurrentAgentDevice = createParamDecorator((_: unknown, ctx: ExecutionContext): AgentDevice => {
  return ctx.switchToHttp().getRequest<AgentRequest>().agentDevice!;
});
