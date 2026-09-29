import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { AgentTokenGuard, type AgentDevice } from "./agent/agent-token.guard";
import { CurrentAgentDevice } from "./agent/current-agent-device.decorator";
import { FaceIdAgentService } from "./face-id-agent.service";
import { FaceIdCommandsService } from "./face-id-commands.service";
import { AgentEventsDto } from "./dto/agent-events.dto";
import { AgentCommandsQueryDto } from "./dto/agent-commands-query.dto";
import { AgentCommandAckDto } from "./dto/agent-command-ack.dto";

/**
 * Obyektdagi `hik-agent` uchun endpointlar. Foydalanuvchi JWT'si emas,
 * qurilmaga bog'langan agent tokeni (`Authorization: Bearer hik_...`).
 */
@ApiBearerAuth()
@ApiTags("Face ID agent")
@Public()
@UseGuards(AgentTokenGuard)
@Controller("agent")
export class FaceIdAgentController {
  constructor(
    private readonly agentService: FaceIdAgentService,
    private readonly commandsService: FaceIdCommandsService,
  ) {}

  @Get("config")
  config(@CurrentAgentDevice() device: AgentDevice) {
    return this.agentService.config(device);
  }

  @Post("events")
  @HttpCode(200)
  events(@CurrentAgentDevice() device: AgentDevice, @Body() dto: AgentEventsDto) {
    return this.agentService.ingestEvents(device, dto.events);
  }

  @Get("commands")
  async commands(@CurrentAgentDevice() device: AgentDevice, @Query() query: AgentCommandsQueryDto) {
    await this.agentService.touch(device.id);
    return this.commandsService.dispatch(device, query.limit);
  }

  @Post("commands/:id/ack")
  @HttpCode(200)
  ack(
    @CurrentAgentDevice() device: AgentDevice,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AgentCommandAckDto,
  ) {
    return this.commandsService.ack(device, id, dto);
  }

  /**
   * SET_FACE buyrug'i uchun xodim surati (binar). Surat bazada saqlangani
   * uchun buyruq payload'iga qo'yilmaydi — agent shu yerdan oladi.
   */
  @Get("commands/:id/face")
  async face(@CurrentAgentDevice() device: AgentDevice, @Param("id", new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const image = await this.commandsService.faceImage(device, id);
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.send(image.data);
  }
}
